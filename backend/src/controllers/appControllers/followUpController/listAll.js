const { scopedFilter } = require('../../../middlewares/ownership');
const { withDateWindow } = require('../../../utils/dateRange');

/**
 * GET /api/followup/listAll
 *
 * Every follow-up the caller may see, narrowed by the optional filters the
 * module sends:
 *
 *   lead     only this lead's follow-ups - the pipeline card's drawer uses it
 *   client   only this customer's
 *   status   'completed' or 'pending'
 *   channel  one of the enum values
 *
 * The header's date window is applied through withDateWindow, and because
 * FollowUp declares a real `date`, it measures the follow-up's DUE date. That is
 * the reading the module's Today/Overdue tabs assume: moving the header to
 * "Today" shows what is due today, not what was scheduled today.
 *
 * Isolation is unchanged and cannot be widened here: scopedFilter carries the
 * tenant and, for a child account, the "mine or assigned to me" clause, and the
 * window is a separate `$and` entry that can only remove rows from it.
 *
 * Sorted by due date ascending - the thing a follow-up list is read to answer is
 * "what is next" - with the newest record breaking ties.
 */
const listAll = async (Model, req, res) => {
  const conditions = [scopedFilter(Model, req)];

  if (req.query.lead) conditions.push({ lead: req.query.lead });
  if (req.query.client) conditions.push({ client: req.query.client });
  if (req.query.channel) conditions.push({ channel: req.query.channel });

  if (req.query.status === 'completed') conditions.push({ completed: true });
  if (req.query.status === 'pending') conditions.push({ completed: false });

  const result = await Model.find(withDateWindow(Model, req, ...conditions))
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
