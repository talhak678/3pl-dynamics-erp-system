const mongoose = require('mongoose');

const { leadFilter, scopedFilter } = require('../../../middlewares/ownership');
const { dateMatchFor } = require('../../../utils/dateRange');

/**
 * The stage weights the forecast multiplies by.
 *
 * Must stay in step with SALES_STAGES in frontend/src/utils/salesStages.js - the
 * stage names are the enum in models/appModels/Lead.js, and a stage missing here
 * would contribute its raw value at weight zero, silently dropping it from the
 * forecast. The UI lets a reader override a weight for what-if analysis; these
 * are the defaults the server applies.
 *
 * Won is 1 because its value is already booked, Lost is 0 because it is not
 * coming back. The rest are the usual pipeline probabilities: a new lead is
 * worth a tenth of its headline figure, a negotiation is worth three quarters.
 */
const STAGE_PROBABILITIES = {
  New: 0.1,
  Contacted: 0.2,
  'Follow-Up': 0.25,
  'Meeting/Demo': 0.4,
  'Proposal Sent': 0.6,
  'In Negotiation': 0.75,
  Won: 1,
  Lost: 0,
};

const STAGE_ORDER = Object.keys(STAGE_PROBABILITIES);

const CLOSED_STAGES = new Set(['Won', 'Lost']);

/** A lead's headline value as a number, tolerating the empty/missing cases. */
const valueOf = (lead) => {
  const value = Number(lead.total);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const probabilityOf = (stage) => STAGE_PROBABILITIES[stage] ?? 0;

/** A MongoDB `$match` for a model's scope plus the requested window, or the scope alone. */
const matchFor = (Model, req) => {
  const clauses = [{ removed: false }, scopedFilter(Model, req)];

  const window = dateMatchFor(Model, req.query);

  if (window) clauses.push(window);

  return { $and: clauses };
};

/**
 * GET /api/salesforecast/summary
 *
 * The forecasting engine: one read that synthesises the pipeline, the documents
 * already in play and the revenue already booked, all inside the caller's
 * workspace and the header's date window.
 *
 * Sources, and what each is used for:
 *
 *   Lead     the open pipeline, its stage-by-stage weighted value, win rate and
 *            average deal size. Lead's window is `created` - the schema has no
 *            expected-close date, so a cohort reading is the honest one; see
 *            Note on cohorting below.
 *   Offer    quoted pipeline value (offers not declined or cancelled)
 *   Quote    quoted pipeline value on the quote side
 *   Order    order value in the window, excluding cancelled orders
 *   Invoice  booked revenue in the window, excluding cancelled invoices
 *
 * The offer/quote/order/invoice figures are reported separately rather than
 * added together. They overlap: an accepted offer becomes an invoice, an order
 * may be invoiced, and summing them would count one sale several times. The KPI
 * uses the lead pipeline for the forecast and the invoice total for what has
 * actually been billed; the other sources are there for the breakdown.
 *
 * Note on cohorting: a lead's stage is its CURRENT stage, and there is no
 * `wonAt`. A lead that was opened in an earlier period but won in this one is
 * therefore not in a window over `created`. The response says the win rate is
 * computed over the leads opened in the window rather than leaving the screen to
 * imply otherwise.
 *
 * Isolation: every source is read through the same filters the rest of the app
 * uses - leadFilter for leads (tenant plus a child account's "mine or assigned"),
 * scopedFilter for the documents - and the window is a separate clause, so it
 * can only remove rows. Nothing here can widen what an account already sees.
 */
const summary = async (req, res) => {
  const Lead = mongoose.model('Lead');
  const Offer = mongoose.model('Offer');
  const Quote = mongoose.model('Quote');
  const Order = mongoose.model('Order');
  const Invoice = mongoose.model('Invoice');

  const leadClauses = [{ removed: false }, leadFilter(req)];
  const leadWindow = dateMatchFor(Lead, req.query);

  if (leadWindow) leadClauses.push(leadWindow);

  const leads = await Lead.find({ $and: leadClauses })
    .select('name salesStage total followUpDate assignedTo created')
    .populate({ path: 'assignedTo', select: 'name surname email' })
    .lean()
    .exec();

  const stageTotals = new Map(
    STAGE_ORDER.map((stage) => [
      stage,
      { stage, count: 0, rawValue: 0, probability: probabilityOf(stage), weightedValue: 0 },
    ])
  );

  let pipelineValue = 0;
  let weightedValue = 0;
  let commitValue = 0;
  let openCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  let wonValue = 0;

  const openLeads = [];

  for (const lead of leads) {
    const value = valueOf(lead);
    const stage = STAGE_ORDER.includes(lead.salesStage) ? lead.salesStage : 'New';
    const probability = probabilityOf(stage);
    const weighted = value * probability;

    const bucket = stageTotals.get(stage);
    bucket.count += 1;
    bucket.rawValue += value;
    bucket.weightedValue += weighted;

    if (CLOSED_STAGES.has(stage)) {
      if (stage === 'Won') {
        wonCount += 1;
        wonValue += value;
      } else {
        lostCount += 1;
      }
      continue;
    }

    openCount += 1;
    pipelineValue += value;
    weightedValue += weighted;

    // The two stages a sales manager will commit to. Lower stages are upside,
    // not commitments, which is what best-case below is for.
    if (stage === 'Proposal Sent' || stage === 'In Negotiation') commitValue += weighted;

    openLeads.push({
      id: String(lead._id),
      name: lead.name || 'Unnamed lead',
      stage,
      probability,
      value,
      weightedValue: weighted,
      followUpDate: lead.followUpDate || null,
      assignee:
        lead.assignedTo && typeof lead.assignedTo === 'object'
          ? [lead.assignedTo.name, lead.assignedTo.surname].filter(Boolean).join(' ') ||
            lead.assignedTo.email ||
            null
          : null,
    });
  }

  // The monthly projection: the next six months, with unscheduled pipeline in
  // its own bucket rather than being attributed to a month nobody chose.
  const now = new Date();
  const months = [];

  for (let index = 0; index < 6; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleString('en-GB', { month: 'short', year: 'numeric' }),
      rawValue: 0,
      weightedValue: 0,
    });
  }

  const monthIndex = new Map(months.map((month, index) => [month.key, index]));
  const unscheduled = { key: 'unscheduled', label: 'Unscheduled', rawValue: 0, weightedValue: 0 };

  for (const lead of openLeads) {
    const due = lead.followUpDate ? new Date(lead.followUpDate) : null;

    let bucket = unscheduled;

    if (due && !Number.isNaN(due.getTime()) && due >= now) {
      const key = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
      const index = monthIndex.get(key);

      if (index !== undefined) bucket = months[index];
      else if (due < new Date(now.getFullYear(), now.getMonth() + 6, 1)) bucket = months[0];
    } else if (!due) {
      // No close signal at all. Attributing it to the current month would make
      // the near-term forecast look better than anything supports, so it stays
      // in the unscheduled line.
      bucket = unscheduled;
    }

    bucket.rawValue += lead.value;
    bucket.weightedValue += lead.weightedValue;
  }

  const pipelineMatch = (Model) => matchFor(Model, req);

  const [offerRow] = await Offer.aggregate([
    {
      $match: {
        ...pipelineMatch(Offer),
        status: { $nin: ['declined', 'cancelled'] },
      },
    },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]).exec();

  const [quoteRow] = await Quote.aggregate([
    {
      $match: {
        ...pipelineMatch(Quote),
        status: { $nin: ['declined', 'cancelled'] },
      },
    },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]).exec();

  const [orderRow] = await Order.aggregate([
    {
      $match: {
        ...pipelineMatch(Order),
        status: { $ne: 'cancelled' },
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

  const [invoiceRow] = await Invoice.aggregate([
    {
      $match: {
        ...pipelineMatch(Invoice),
        status: { $ne: 'cancelled' },
      },
    },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]).exec();

  const closedCount = wonCount + lostCount;
  const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;
  const averageDealSize = wonCount > 0 ? wonValue / wonCount : 0;

  const topOpportunities = openLeads
    .filter((lead) => lead.value > 0)
    .sort((a, b) => b.weightedValue - a.weightedValue)
    .slice(0, 8);

  return res.status(200).json({
    success: true,
    result: {
      window: {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
      },
      kpis: {
        pipelineValue,
        weightedValue,
        commitValue,
        bestCaseValue: pipelineValue,
        winRate,
        averageDealSize,
        openCount,
        wonCount,
        lostCount,
        wonValue,
        bookedRevenue: invoiceRow?.total ?? 0,
      },
      stages: STAGE_ORDER.map((stage) => stageTotals.get(stage)),
      months: [...months, unscheduled],
      topOpportunities,
      sources: {
        leadValue: pipelineValue,
        offerValue: offerRow?.total ?? 0,
        offerCount: offerRow?.count ?? 0,
        quoteValue: quoteRow?.total ?? 0,
        quoteCount: quoteRow?.count ?? 0,
        orderValue: orderRow?.total ?? 0,
        orderCount: orderRow?.count ?? 0,
        bookedRevenue: invoiceRow?.total ?? 0,
        invoiceCount: invoiceRow?.count ?? 0,
      },
    },
    message: 'Successfully calculated the sales forecast',
  });
};

module.exports = { summary, STAGE_PROBABILITIES };
