const mongoose = require('mongoose');

/**
 * Keeps `Lead.followUpDate` in step with the follow-up records that replaced it
 * as the source of truth.
 *
 * The pipeline board reads the lead and nothing else, so it has no way to see
 * this collection. Rather than teach the board to fetch a second resource and
 * merge it - two requests that can disagree for a moment - the lead keeps a
 * single cached date: the earliest pending follow-up. Every write through
 * /api/followup/* calls this, so the board and the dedicated module change
 * together. A follow-up scheduled from either screen therefore appears on both.
 *
 * Scoped by `createdBy` on BOTH writes. The follow-up controller has already
 * proved the caller may touch the follow-up, but the lead is a second document
 * and the id came from a request body; without the tenant clause a hand-made
 * request could use a follow-up in its own workspace to rewrite another
 * workspace's lead. This is the same reason every read is tenant-scoped, applied
 * to a write that is easy to overlook.
 *
 * Deliberately tolerant of a missing lead: the follow-up is the record the
 * caller saved, and a lead that has since been deleted must not turn that into a
 * failed request. The cached date simply has nowhere to go.
 *
 * `$set` with null rather than `$unset`: every reader tests the value for truth
 * (`lead.followUpDate ? ... : 'No follow-up set'`), so absent and null behave
 * identically, and a set null keeps the field's shape stable in projections.
 */
const syncLeadFollowUp = async (leadRef, tenantId) => {
  // `lead` is declared autopopulate, so a record read back from the database
  // carries a lead DOCUMENT, not an id. Both callers can hand this helper
  // either shape; without this the populated object fails the ObjectId cast.
  const leadId = leadRef && leadRef._id ? leadRef._id : leadRef;

  if (!leadId || !tenantId) return;

  const FollowUp = mongoose.model('FollowUp');
  const Lead = mongoose.model('Lead');

  const next = await FollowUp.findOne({
    lead: leadId,
    removed: false,
    completed: false,
    createdBy: tenantId,
  })
    .sort({ date: 1 })
    .select('date')
    .lean()
    .exec();

  await Lead.updateOne(
    { _id: leadId, createdBy: tenantId },
    {
      $set: {
        followUpDate: next ? next.date : null,
        updated: new Date(),
      },
    }
  ).exec();
};

module.exports = syncLeadFollowUp;
