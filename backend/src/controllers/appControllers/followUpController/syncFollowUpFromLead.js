const mongoose = require('mongoose');

const { leadFilter, tenantIdOf } = require('../../../middlewares/ownership');

const syncLeadFollowUp = require('./syncLeadFollowUp');

const FOLLOW_UP_STAGE = 'Follow-Up';

/** Populated references arrive as documents; the writes below need the ids. */
const idOf = (value) => (value && value._id ? value._id : value || null);

/** A usable Date from whatever the lead stores, or null. */
const dateOf = (value) => {
  if (!value) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const subjectFor = (lead) => {
  const name = typeof lead.name === 'string' ? lead.name.trim() : '';

  return name ? `Follow up with ${name}` : 'Sales follow-up';
};

/**
 * Creates the follow-up a Lead's own fields imply, when none is pending yet.
 *
 * This is the missing half of the pipeline -> follow-up sync. Dragging a card
 * into the Follow-Up column (or setting `followUpDate`) used to change only the
 * Lead document. The board showed the new stage and the follow-up module showed
 * nothing, because that module reads the FollowUp collection and no record had
 * ever been written there. The write paths now call this after the lead save, so
 * the two screens agree without the board having to make a second request.
 *
 * Rules:
 *   - Only a lead in the Follow-Up stage, or one carrying a `followUpDate` or a
 *     note, implies work. Every other lead returns without a write.
 *   - A pending follow-up already linked to the lead is left alone. This is what
 *     makes the helper safe to call after any edit of a lead that happens to be
 *     in Follow-Up - re-saving its notes must not schedule a second reminder.
 *   - The due date is the lead's own `followUpDate`, falling back to now so the
 *     record is immediately visible as due. `syncLeadFollowUp` then writes that
 *     date back onto the lead, which keeps the board's cache in step.
 *   - `createdBy` is the lead's workspace, never the request body. `assignedTo`
 *     is inherited from the lead so the rep who works it can see the reminder
 *     under the child-account scope (see middlewares/ownership.js).
 *
 * `options.skipExistingCheck` is used by the list backfill, which has already
 * queried every lead id at once and knows which ones have no record at all.
 */
const ensureFollowUpForLead = async (lead, options = {}) => {
  if (!lead) return null;

  const leadId = idOf(lead._id);
  const tenantId = idOf(lead.createdBy);
  const due = dateOf(lead.followUpDate);
  const hasNotes = typeof lead.followUpNotes === 'string' && lead.followUpNotes.trim() !== '';

  if (!leadId || !tenantId) return null;

  // Any one of the lead's three follow-up-shaped fields implies work. Notes on
  // their own are rare (the current lead form sets them beside a date), but a
  // caller that sends them without a date still expects the reminder to exist;
  // it is due immediately, which is the same fallback an undated stage move
  // uses.
  if (lead.salesStage !== FOLLOW_UP_STAGE && !due && !hasNotes) return null;

  const FollowUp = mongoose.model('FollowUp');

  /*
   * Backfill semantics are stricter than write-path semantics: if ANY record
   * has ever existed for this lead - completed, or soft-deleted - the backfill
   * leaves it alone. Otherwise deleting a follow-up would resurrect it on the
   * next list request, because the lead is still in the Follow-Up stage.
   */
  if (!options.skipExistingCheck) {
    const existing = options.backfill
      ? await FollowUp.exists({ lead: leadId, createdBy: tenantId })
      : await FollowUp.exists({
          lead: leadId,
          createdBy: tenantId,
          removed: false,
          completed: false,
        });

    if (existing) {
      /*
       * The lead form is a second place the next follow-up's date and note can
       * be edited. When it sends those fields explicitly, move the EARLIEST
       * pending reminder to match: the lead's single `followUpDate` has always
       * meant "the next one", and leaving the old date in place would show a
       * different answer on the board than in the queue.
       *
       * Backfill never takes this branch - it only creates records for leads
       * that have none, and must not rewrite history.
       */
      const updates = {};

      if (options.syncDate && due) updates.date = due;
      if (options.syncNotes) {
        updates.notes = typeof lead.followUpNotes === 'string' ? lead.followUpNotes : '';
      }

      if (Object.keys(updates).length > 0) {
        await FollowUp.findOneAndUpdate(
          { lead: leadId, createdBy: tenantId, removed: false, completed: false },
          { $set: { ...updates, updated: new Date() } },
          { sort: { date: 1 } }
        ).exec();

        // Keep the lead's cached "next due" honest even if another pending
        // reminder is still earlier than the date just written.
        await syncLeadFollowUp(leadId, tenantId);
      }

      return 'existing';
    }
  }

  /*
   * Upsert rather than find-then-save. The filter is the "pending follow-up for
   * this lead" definition, so two requests arriving together (a board drag and a
   * list read, say) resolve to one row instead of two reminders for one lead.
   *
   * `lead`, `createdBy`, `removed` and `completed` come from the filter, which
   * MongoDB copies into the inserted document on an upsert; the remaining fields
   * are the ones this helper owns.
   */
  const result = await FollowUp.updateOne(
    { lead: leadId, createdBy: tenantId, removed: false, completed: false },
    {
      $setOnInsert: {
        enabled: true,
        createdByUser: idOf(lead.createdByUser),
        assignedTo: idOf(lead.assignedTo),
        client: null,
        subject: subjectFor(lead),
        notes: typeof lead.followUpNotes === 'string' ? lead.followUpNotes : '',
        channel: 'Call',
        date: due || new Date(),
        created: new Date(),
        updated: new Date(),
      },
    },
    { upsert: true }
  ).exec();

  if (result.upsertedCount > 0) {
    await syncLeadFollowUp(leadId, tenantId);
    return 'created';
  }

  return 'existing';
};

/**
 * Brings leads that predate the follow-up sync into the module.
 *
 * Called by followUpController/listAll before it reads the collection, so the
 * screen self-heals rather than depending on a migration somebody has to
 * remember to run. The lead selection and the "already has a record" check are
 * two queries total; only the gaps are written, and each write is the same
 * upsert the live path uses.
 *
 * Scoped through `leadFilter`, so this can only ever see and create records in
 * the caller's workspace - and, for a child account, only for its own or
 * assigned leads. A backfill triggered by a list request must never be a way to
 * reach across tenants.
 */
const backfillFollowUps = async (req) => {
  const Lead = mongoose.model('Lead');
  const FollowUp = mongoose.model('FollowUp');

  const tenantId = tenantIdOf(req && req.admin);

  if (!tenantId) return 0;

  const leads = await Lead.find({
    $and: [
      { removed: false },
      leadFilter(req),
      {
        $or: [
          { salesStage: FOLLOW_UP_STAGE },
          { followUpDate: { $ne: null } },
          // `$exists` is required: `$nin` alone also matches a document that has
          // no such field at all, which would select every lead in the workspace.
          { followUpNotes: { $exists: true, $nin: [null, ''] } },
        ],
      },
    ],
  })
    .select('_id name salesStage followUpDate followUpNotes assignedTo createdBy createdByUser')
    .lean()
    .exec();

  if (leads.length === 0) return 0;

  const leadIds = leads.map((lead) => lead._id);

  // Includes completed and soft-deleted records on purpose: a lead somebody has
  // already dealt with must not gain a fresh reminder just because its stage is
  // still Follow-Up. See ensureFollowUpForLead.
  const existingIds = new Set(
    (
      await FollowUp.find({ lead: { $in: leadIds }, createdBy: tenantId })
        .distinct('lead')
        .exec()
    ).map(String)
  );

  let created = 0;

  for (const lead of leads) {
    if (existingIds.has(String(lead._id))) continue;

    try {
      const outcome = await ensureFollowUpForLead(lead, { skipExistingCheck: true });

      if (outcome === 'created') created += 1;
    } catch (error) {
      // The list must still render. A failed backfill for one lead is logged
      // and retried by the next request rather than turning the queue into a
      // 500 for every other record in the workspace.
      console.error('Could not backfill a follow-up from a lead:', error.message);
    }
  }

  return created;
};

module.exports = { ensureFollowUpForLead, backfillFollowUps, FOLLOW_UP_STAGE };
