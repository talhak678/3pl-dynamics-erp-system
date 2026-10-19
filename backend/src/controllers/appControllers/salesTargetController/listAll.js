const { scopedFilter, isChildUser } = require('../../../middlewares/ownership');
const { datedWindowFor } = require('../../../utils/dateRange');

const { computeActuals, decorateTarget, summariseTargets } = require('./actuals');

/**
 * GET /api/salestarget/listAll
 *
 * Every target the caller may see, each with its achieved figure computed from
 * the workspace's real records, plus the banner summary.
 *
 * Two filters narrow the list, and both can only remove rows:
 *
 *   tenant     scopedFilter carries `createdBy`, as every read in this family
 *              does. SalesTarget is not in SCOPED_MODEL_NAMES, so for a child
 *              account this is the tenant clause alone and the next line does
 *              the person-shaped narrowing.
 *
 *   assignee   a child account is shown the targets assigned to it and the
 *              company-wide ones. A company-wide target is the account's own
 *              target too - hiding it would make the module useless to the
 *              salespeople it is for - and a target assigned to a colleague is
 *              not theirs to read.
 *
 *   created    the header's global date window, through datedWindowFor. It
 *              measures `created` because a target stores its period as
 *              startDate/endDate, not as a `date` path; the window decides which
 *              target CARDS are listed and each card's own period decides which
 *              records count toward it.
 *
 * The achieved figure is computed per target rather than in one aggregation,
 * because each target has its own window and optional assignee. That is one query
 * per target (two for a deals target); a workspace runs a handful of targets, so
 * the simplicity is worth more than the round trips.
 */
const listAll = async (Model, req, res) => {
  const conditions = [scopedFilter(Model, req)];

  if (isChildUser(req.admin)) {
    conditions.push({
      $or: [{ assignee: req.admin._id }, { assignee: null }, { assignee: { $exists: false } }],
    });
  }

  const windowClause = datedWindowFor(Model, req);

  if (windowClause) conditions.push(windowClause);

  const targets = await Model.find({ $and: conditions })
    .sort({ endDate: 1, created: -1 })
    .exec();

  const now = new Date();

  const result = [];

  for (const target of targets) {
    // The document still carries createdBy, which is what computeActuals uses as
    // the tenant. Convert only after the figures are computed.
    const actuals = await computeActuals(target);

    result.push(decorateTarget(target.toObject(), actuals, now));
  }

  return res.status(200).json({
    success: true,
    result,
    summary: summariseTargets(result),
    message: result.length > 0 ? 'Successfully found all documents' : 'Collection is Empty',
  });
};

module.exports = listAll;
