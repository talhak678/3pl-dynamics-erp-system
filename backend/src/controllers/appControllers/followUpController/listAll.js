const { scopedFilter } = require('../../../middlewares/ownership');

const { backfillFollowUps } = require('./syncFollowUpFromLead');

/**
 * GET /api/followup/listAll
 *
 * Every follow-up the caller may see, narrowed only by the optional filters the
 * module sends:
 *
 *   lead     only this lead's follow-ups - the pipeline card's drawer uses it
 *   client   only this customer's
 *   status   'completed' or 'pending'
 *   channel  one of the enum values
 *
 * There is deliberately NO global date window here. A follow-up's `date` is
 * when it is DUE, which is in the future for anything scheduled ahead; the
 * header's default window ends today, so applying it hid every follow-up
 * scheduled for tomorrow and the table stayed empty immediately after a
 * successful create. FollowUp is therefore not in DATED_MODELS, and this list
 * is the whole tenant-scoped queue. Today, Upcoming, Overdue and Completed are
 * the module's own tabs, which is the correct place for that reading.
 *
 * Before reading, `backfillFollowUps` materialises records for leads that are in
 * the Follow-Up stage (or carry a `followUpDate`) but predate the pipeline sync.
 * That is what makes this module self-healing against the board: the board
 * writes the lead, and the next read of the queue reflects it.
 *
 * Isolation is unchanged and cannot be widened here: scopedFilter carries the
 * tenant and, for a child account, the "mine or assigned to me" clause.
 *
 * Sorted by due date ascending - the thing a follow-up list is read to answer is
 * "what is next" - with the newest record breaking ties.
 */
const listAll = async (Model, req, res) => {
  await backfillFollowUps(req);

  const conditions = [{ removed: false }, scopedFilter(Model, req)];

  if (req.query.lead) conditions.push({ lead: req.query.lead });
  if (req.query.client) conditions.push({ client: req.query.client });
  if (req.query.channel) conditions.push({ channel: req.query.channel });

  if (req.query.status === 'completed') conditions.push({ completed: true });
  if (req.query.status === 'pending') conditions.push({ completed: false });

  const result = await Model.find({ $and: conditions })
    .sort({ date: 1, created: -1 })
    .populate()
    .exec();

  return res.status(200).json({
    success: true,
    result,
    message: result.length > 0 ? 'Successfully found all documents' : 'Collection is Empty',
  });
};

module.exports = listAll;
