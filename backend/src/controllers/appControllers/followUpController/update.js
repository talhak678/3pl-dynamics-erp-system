const { scopedFilter } = require('../../../middlewares/ownership');
const { applyAssignedTo } = require('../../../utils/assignee');

const { resolveLink, parseDate, isBlank } = require('./resolveLink');
const syncLeadFollowUp = require('./syncLeadFollowUp');

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * PATCH /api/followup/update/:id
 *
 * Edits the due date, channel, notes or link, and is also how a follow-up is
 * marked complete in one click: `{ completed: true }` on its own is a valid
 * update.
 *
 * The existing record is read first, through the same scoped filter the write
 * uses. That is not just a 404 check - it carries the old lead id, which has to
 * be resynced when a follow-up is moved from one lead to another, and the old
 * completed state, which decides whether `completedAt` is stamped now or left
 * alone.
 *
 * `completedAt` is server-written and never taken from the body: it is the
 * moment the button was pressed, not a value a client may choose.
 */
const update = async (Model, req, res) => {
  const existing = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...scopedFilter(Model, req),
  }).exec();

  if (!existing) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  }

  // The model declares `lead`/`client` as autopopulate, so this read hands back
  // documents rather than ids. Both `resolveLink` (which validates a 24-hex id)
  // and the previous-lead comparison below need the bare id.
  const idOf = (value) => (value && value._id ? value._id : value);

  const link = await resolveLink(req, {
    lead: has(req.body, 'lead') ? req.body.lead : idOf(existing.lead),
    client: has(req.body, 'client') ? req.body.client : idOf(existing.client),
  });

  if (!link.ok) {
    return res.status(link.status).json({
      success: false,
      result: null,
      message: link.message,
    });
  }

  let date = existing.date;

  if (has(req.body, 'date')) {
    date = parseDate(req.body.date);

    if (!date) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'A due date is required for a follow-up.',
      });
    }
  }

  // Applied before the explicit field copy below, so an assignee the caller may
  // not choose is removed from the body and the record keeps whoever it had.
  const assignment = await applyAssignedTo(Model, req);

  if (!assignment.ok) {
    return res.status(assignment.status).json({
      success: false,
      result: null,
      message: assignment.error,
    });
  }

  const completed = has(req.body, 'completed')
    ? req.body.completed === true
    : existing.completed === true;

  let completedAt = existing.completedAt || null;

  if (completed && !existing.completed) completedAt = new Date();
  if (!completed) completedAt = null;

  const updates = {
    lead: link.lead,
    client: link.client,
    date,
    completed,
    completedAt,
    updated: new Date(),
  };

  // Only fields the caller actually sent. `undefined` would be skipped by
  // mongoose anyway, but writing them explicitly keeps a partial update from
  // clearing a value through an absent key.
  if (has(req.body, 'subject')) updates.subject = req.body.subject;
  if (has(req.body, 'notes')) updates.notes = req.body.notes;
  if (has(req.body, 'outcome')) updates.outcome = req.body.outcome;
  if (has(req.body, 'channel') && !isBlank(req.body.channel)) updates.channel = req.body.channel;
  if (has(req.body, 'enabled')) updates.enabled = req.body.enabled !== false;
  if (has(req.body, 'assignedTo')) updates.assignedTo = req.body.assignedTo;
  // Kept in step with create: a follow-up with no explicit assignee inherits the
  // lead's, so moving an unassigned follow-up onto a rep's lead hands it to them
  // rather than leaving a reminder only the owner can read.
  else if (!existing.assignedTo && link.leadAssignee) updates.assignedTo = link.leadAssignee;

  // Captured before the write: moving a follow-up from one lead to another has
  // to resync the lead it LEFT as well as the one it joined.
  const previousLead = idOf(existing.lead);

  existing.set(updates);
  await existing.save();

  await syncLeadFollowUp(link.lead, req.admin.tenantId);

  if (previousLead && String(previousLead) !== String(link.lead)) {
    await syncLeadFollowUp(previousLead, req.admin.tenantId);
  }

  const result = await Model.findById(existing._id).exec();

  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully updated the follow-up',
  });
};

module.exports = update;
