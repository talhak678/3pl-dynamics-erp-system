const mongoose = require('mongoose');

const { tenantIdOf } = require('../../../middlewares/ownership');

/**
 * The "this person's rows" clause for a target's actuals.
 *
 * A target can be company-wide (`assignee` absent) or point at one
 * salesperson. For the second kind the same two halves the rest of the app uses
 * apply: a record counts if it was handed to that person OR entered by them.
 * Testing assignment alone would miss everything they typed in themselves, which
 * is most of a salesperson's work.
 *
 * Returned as an `$or` and spread into a `$match`/query object that has no other
 * `$or` key, so it composes safely. See the warning in middlewares/ownership.js
 * about two `$or` keys replacing one another.
 */
const personClause = (assignee) =>
  assignee
    ? {
        $or: [{ assignedTo: assignee }, { createdByUser: assignee }],
      }
    : {};

const startOfWindow = (target) => target.startDate;
const endOfWindow = (target) => target.endDate;

/**
 * What has actually been achieved against a target, from the real records.
 *
 * Nothing is stored on the target - see the model comment. Two different
 * measures, matching the two target types:
 *
 *   Revenue  the sum of Invoice totals dated inside the period, excluding
 *            cancelled invoices. The invoice is the app's financial record: an
 *            order records that goods moved, but it is the invoice that says
 *            what was billed, and summing both would count the same sale twice.
 *            `orderRevenue` is returned alongside so the figure can be
 *            understood rather than guessed at; it is not added.
 *
 *   Deals    non-cancelled Orders created inside the period, plus Won leads that
 *            have not been converted. An order is a closed deal. A won lead is
 *            one, too, but a converted lead already produced the order that is
 *            being counted, so `converted: true` is excluded - counting both
 *            would report one sale as two.
 *
 * Tenancy is `createdBy` on every source, which is the workspace. The optional
 * assignee clause narrows within it and can never widen it.
 */
const computeActuals = async (target) => {
  const tenantId = target.createdBy;
  const base = { removed: false, createdBy: tenantId };

  const window = {
    $gte: startOfWindow(target),
    $lte: endOfWindow(target),
  };

  const person = personClause(target.assignee);

  if (target.type === 'Deals') {
    const Order = mongoose.model('Order');
    const Lead = mongoose.model('Lead');

    const [orderCount, wonLeadCount] = await Promise.all([
      Order.countDocuments({
        ...base,
        // Order has no business date of its own; it records when it was placed.
        created: window,
        status: { $ne: 'cancelled' },
        ...person,
      }).exec(),
      Lead.countDocuments({
        ...base,
        created: window,
        salesStage: 'Won',
        converted: { $ne: true },
        ...person,
      }).exec(),
    ]);

    return {
      achieved: orderCount + wonLeadCount,
      unit: 'deals',
      orderCount,
      wonLeadCount,
    };
  }

  const Invoice = mongoose.model('Invoice');
  const Order = mongoose.model('Order');

  const [invoiceRow] = await Invoice.aggregate([
    {
      $match: {
        ...base,
        // A real business date, so "billed in the period" is the question this
        // answers - not "entered in the period".
        date: window,
        status: { $ne: 'cancelled' },
        ...person,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$total' },
        count: { $sum: 1 },
      },
    },
  ]).exec();

  // Reported, not summed into `achieved` - see the comment above.
  const [orderRow] = await Order.aggregate([
    {
      $match: {
        ...base,
        created: window,
        status: { $ne: 'cancelled' },
        ...person,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $multiply: ['$price', '$quantity'] } },
        count: { $sum: 1 },
      },
    },
  ]).exec();

  return {
    achieved: invoiceRow?.total ?? 0,
    unit: 'currency',
    invoiceCount: invoiceRow?.count ?? 0,
    orderRevenue: orderRow?.total ?? 0,
    orderCount: orderRow?.count ?? 0,
  };
};

/**
 * A target as the API hands it back: the stored fields plus the computed
 * progress the screens render.
 *
 * `progress` is deliberately not clamped. A target at 130% has been exceeded,
 * and the table shows that figure; the Progress component clamps its own bar, so
 * nothing renders past full. `daysRemaining` counts whole days and never goes
 * negative - a finished period has no days left, not days owed.
 *
 * The status thresholds are the useful ones for a manager reading a list:
 *   exceeded  the figure is met
 *   upcoming  the period has not started
 *   missed    the period ended below target
 *   on-track  progress is within five points of where elapsed time says it
 *             should be
 *   at-risk   everything else
 */
const decorateTarget = (target, actuals, now = new Date()) => {
  const start = new Date(target.startDate);
  const end = new Date(target.endDate);

  const dayMs = 24 * 60 * 60 * 1000;
  const totalMs = Math.max(end - start, 0);
  const elapsedMs = Math.min(Math.max(now - start, 0), totalMs);
  const elapsedPct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;

  const progress = target.targetValue > 0 ? (actuals.achieved / target.targetValue) * 100 : 0;

  let status = 'on-track';

  if (now < start) status = 'upcoming';
  else if (actuals.achieved >= target.targetValue) status = 'exceeded';
  else if (now > end) status = 'missed';
  else if (progress + 5 < elapsedPct) status = 'at-risk';

  return {
    ...target,
    ...actuals,
    progress,
    displayProgress: Math.min(Math.round(progress), 100),
    elapsedPct: Math.round(elapsedPct),
    daysRemaining: Math.max(0, Math.ceil((end - now) / dayMs)),
    status,
  };
};

/**
 * The figures for the banner above the table.
 *
 * Revenue and deals are summed separately and never added together: they are
 * different units, and a single "overall" percentage mixing them would be
 * meaningless. `overallAchievement` is the revenue figure's percentage because
 * that is the one the banner leads with.
 */
const summariseTargets = (targets) => {
  const revenue = targets.filter((target) => target.type === 'Revenue');
  const deals = targets.filter((target) => target.type === 'Deals');

  const totalTargetRevenue = revenue.reduce((sum, target) => sum + (target.targetValue || 0), 0);
  const achievedRevenue = revenue.reduce((sum, target) => sum + (target.achieved || 0), 0);

  return {
    count: targets.length,
    totalTargetRevenue,
    achievedRevenue,
    overallAchievement:
      totalTargetRevenue > 0 ? (achievedRevenue / totalTargetRevenue) * 100 : 0,
    remainingGap: Math.max(totalTargetRevenue - achievedRevenue, 0),
    totalDealsTarget: deals.reduce((sum, target) => sum + (target.targetValue || 0), 0),
    achievedDeals: deals.reduce((sum, target) => sum + (target.achieved || 0), 0),
    exceeded: targets.filter((target) => target.status === 'exceeded').length,
    atRisk: targets.filter((target) => target.status === 'at-risk').length,
  };
};

module.exports = { computeActuals, decorateTarget, summariseTargets };
