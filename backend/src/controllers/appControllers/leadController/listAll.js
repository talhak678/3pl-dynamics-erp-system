const { migrate } = require('./migrate');
const { leadFilter } = require('../../../middlewares/ownership');
const { withDateWindow } = require('../../../utils/dateRange');

/**
 * GET /api/lead/listAll
 *
 * Every lead the caller may see. Two different screens read it, and they want
 * different things from it:
 *
 *   - The Sales Pipeline board and the offer form's lead picker want all of
 *     them, and ask with no query parameters at all.
 *   - The dashboard's sales analytics cards want the ones inside the date range
 *     the reader has chosen, and ask with `startDate` and `endDate`.
 *
 * Both are served by sending the window through when it is there and leaving the
 * query exactly as it was when it is not, so neither screen has to know about
 * the other. A request with no window produces `$and: [{removed: false}, scope]`,
 * which is the same set the flat `{removed: false, ...scope}` it replaced
 * returned.
 *
 * The window is measured against `created`, the moment the lead was entered -
 * not, as one might expect, against a `createdAt`. This schema does not use
 * Mongoose timestamps: it declares `created` and `updated` itself and has no
 * `createdAt` path at all, so a filter on that name would match nothing and the
 * cards would read zero for every range. `created` is also what the model's
 * `date` slot resolves to - Lead has no business date, unlike Invoice or Quote,
 * which is why utils/dateRange.js picks `created` for it without being told.
 *
 * A caveat this endpoint cannot fix, recorded here because the figures are
 * computed from what it returns: `salesStage` is a lead's CURRENT state, not a
 * record of when it changed. There is no `wonAt`, so a window over `created`
 * counts leads that were OPENED in the range and are now Won - a cohort - rather
 * than deals that were WON in the range. The two are different numbers whenever
 * a lead is closed in a later period than it was opened, and the dashboard
 * captions the cards accordingly rather than letting them imply the second.
 *
 * Isolation is unchanged and cannot be widened from here. `leadFilter(req)`
 * carries the tenant and, for a child account, the $or over authorship and
 * assignment; `withDateWindow` puts that and the window in separate `$and`
 * entries, so the window can only remove rows from what the caller was already
 * allowed to read. See utils/dateRange.js.
 */
const listAll = async (Model, req, res) => {
  const sort = parseInt(req.query.sort) || 'desc';

  //  Query the database for a list of all results
  const result = await Model.find(withDateWindow(Model, req, leadFilter(req)))
    .sort({ created: sort })
    .populate()
    .exec();

  const migratedData = result.map((x) => migrate(x));
  if (result.length > 0) {
    return res.status(200).json({
      success: true,
      result: migratedData,
      message: 'Successfully found all documents',
    });
  } else {
    return res.status(203).json({
      success: true,
      result: [],
      message: 'Collection is Empty',
    });
  }
};

module.exports = listAll;
