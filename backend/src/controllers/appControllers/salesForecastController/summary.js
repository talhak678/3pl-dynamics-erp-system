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

/**
 * Weights for the document sources that are not attached to a lead.
 *
 * An active offer is a proposal in front of the customer, so it is weighted
 * like the Proposal Sent stage. A quote is earlier - it may still be a draft or
 * under review - so half is the honest default. Orders and invoices are not
 * weighted at all: they are already booked, and they are reported separately.
 */
const OFFER_PROBABILITY = 0.6;
const QUOTE_PROBABILITY = 0.5;

/** A money field as a number, treating missing, empty and negative as zero. */
const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const probabilityOf = (stage) => STAGE_PROBABILITIES[stage] ?? 0;

/** A historical source: its scope plus the header window, when one was sent. */
const windowedScopeFor = (Model, req, extra) => {
  const clauses = [{ removed: false }, scopedFilter(Model, req), extra];
  const window = dateMatchFor(Model, req.query);

  if (window) clauses.push(window);

  return { $and: clauses };
};

/**
 * GET /api/salesforecast/summary
 *
 * The forecasting engine: one read that synthesises the live pipeline, the
 * documents already in play and the revenue already booked, all inside the
 * caller's workspace.
 *
 * What is windowed and what is not:
 *
 *   Open leads, active offers and active quotes are NOT limited by the header
 *   window. They are work still in play today; a deal opened before the default
 *   30-day range is still an open deal, and excluding it made every KPI read
 *   zero. The window continues to bound the historical questions: won/lost
 *   outcomes for the win rate (falling back to all-time if the range contains
 *   no closed lead) and the order/invoice figures in the source breakdown.
 *
 * Value derivation:
 *
 *   A Lead's own `total` is used when it is positive. Many leads in this ERP
 *   carry no monetary value at all, so when it is zero the lead inherits the
 *   LARGEST active Offer linked to it (`Offer.lead`). The largest, not the sum:
 *   repeated offers for one deal are revisions, and adding them would inflate
 *   the pipeline. Quotes have no `lead` reference, so they cannot be attached to
 *   a lead; they are counted as their own active pipeline below.
 *
 * Sources, and what each is used for:
 *
 *   Lead    the open pipeline and its stage-by-stage weighted value
 *   Offer   linked offers value leads with no total of their own. Offers whose
 *           lead is outside this account's lead scope (possible for a child
 *           account) are added as document pipeline.
 *   Quote   client proposals with no lead link - always document pipeline.
 *   Order   order value in the window, excluding cancelled orders
 *   Invoice booked revenue in the window, excluding cancelled invoices
 *
 * The sources are reported separately rather than all being summed into one
 * number. They overlap: an accepted offer becomes an invoice and an order may be
 * invoiced. The forecast adds only the document pipeline that is not already
 * represented by a lead; the breakdown exists so the figures can be understood
 * rather than guessed at.
 *
 * Isolation: every source is read through the same filters the rest of the app
 * uses - leadFilter for leads (tenant plus a child account's "mine or
 * assigned"), scopedFilter for the documents - and a window, where one applies,
 * is a separate clause, so it can only remove rows. Nothing here can widen what
 * an account already sees.
 */
const summary = async (req, res) => {
  const Lead = mongoose.model('Lead');
  const Offer = mongoose.model('Offer');
  const Quote = mongoose.model('Quote');
  const Order = mongoose.model('Order');
  const Invoice = mongoose.model('Invoice');

  /*
   * Every lead in scope, deliberately unwindowed. `created` on a lead is when it
   * was entered, not when it is expected to close, so a 30-day cohort is the
   * wrong reading for "what is my open pipeline today".
   */
  const leads = await Lead.find({ $and: [{ removed: false }, leadFilter(req)] })
    .select('name salesStage total followUpDate assignedTo created')
    .populate({ path: 'assignedTo', select: 'name surname email' })
    .lean()
    .exec();

  /*
   * Active offers grouped by lead. Autopopulate would fetch every linked lead
   * document here, which this needs neither for the id nor for the value, so the
   * aggregation works on the stored ids.
   */
  const offerRows = await Offer.aggregate([
    {
      $match: {
        $and: [
          { removed: false },
          scopedFilter(Offer, req),
          { status: { $nin: ['declined', 'cancelled'] } },
        ],
      },
    },
    {
      $group: {
        _id: '$lead',
        // The largest offer of any still-live state values a lead that has no
        // total of its own. Accepted offers are included: the deal is real even
        // if the offer has already been converted to an invoice.
        maxValue: { $max: '$total' },
        // The document pipeline, by contrast, excludes converted offers. One
        // that has become an invoice is booked revenue, and counting it as live
        // pipeline as well would count the same sale twice.
        activeValue: {
          $sum: { $cond: [{ $eq: ['$converted', true] }, 0, '$total'] },
        },
        activeCount: {
          $sum: { $cond: [{ $eq: ['$converted', true] }, 0, 1] },
        },
      },
    },
  ]).exec();

  const [quoteRow] = await Quote.aggregate([
    {
      $match: {
        $and: [
          { removed: false },
          scopedFilter(Quote, req),
          { status: { $nin: ['declined', 'cancelled'] } },
          // A quote that became an invoice is booked revenue, not pipeline.
          { converted: { $ne: true } },
        ],
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

  const offerMaxByLead = new Map();
  let offerValue = 0;
  let offerCount = 0;

  for (const row of offerRows) {
    if (row._id) offerMaxByLead.set(String(row._id), numberOrZero(row.maxValue));
    offerValue += numberOrZero(row.activeValue);
    offerCount += row.activeCount || 0;
  }

  const quoteValue = numberOrZero(quoteRow?.total);
  const quoteCount = quoteRow?.count ?? 0;

  const visibleLeadIds = new Set(leads.map((lead) => String(lead._id)));

  // Offers attached to a lead this account cannot see are not represented in
  // the lead pipeline, so they are counted on their own rather than dropped.
  let documentOfferValue = 0;

  for (const row of offerRows) {
    if (!row._id || !visibleLeadIds.has(String(row._id))) {
      documentOfferValue += numberOrZero(row.activeValue);
    }
  }

  const stageTotals = new Map(
    STAGE_ORDER.map((stage) => [
      stage,
      { stage, count: 0, rawValue: 0, probability: probabilityOf(stage), weightedValue: 0 },
    ])
  );

  let leadPipelineValue = 0;
  let leadWeightedValue = 0;
  let leadCommitValue = 0;
  let openCount = 0;

  // All-time closed outcomes, kept so the win rate has a fallback when the
  // selected window contains no closed lead.
  let allWonCount = 0;
  let allLostCount = 0;
  let allWonValue = 0;

  const openLeads = [];

  for (const lead of leads) {
    const ownValue = numberOrZero(lead.total);
    const linkedOfferValue = offerMaxByLead.get(String(lead._id)) || 0;

    // The lead's own figure wins; an Offer only fills a gap. See the value
    // derivation note above.
    const value = ownValue > 0 ? ownValue : linkedOfferValue;

    const stage = STAGE_ORDER.includes(lead.salesStage) ? lead.salesStage : 'New';
    const probability = probabilityOf(stage);
    const weighted = value * probability;

    const bucket = stageTotals.get(stage);
    bucket.count += 1;
    bucket.rawValue += value;
    bucket.weightedValue += weighted;

    if (CLOSED_STAGES.has(stage)) {
      if (stage === 'Won') {
        allWonCount += 1;
        allWonValue += value;
      } else {
        allLostCount += 1;
      }
      continue;
    }

    openCount += 1;
    leadPipelineValue += value;
    leadWeightedValue += weighted;

    // The two stages a sales manager will commit to. Lower stages are upside,
    // not commitments, which is what best-case below is for.
    if (stage === 'Proposal Sent' || stage === 'In Negotiation') leadCommitValue += weighted;

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

  /*
   * The win-rate cohort.
   *
   * A lead's stage is its CURRENT stage and there is no `wonAt`, so the only
   * date available is when the lead was entered. That makes the windowed figure
   * a cohort reading, which the response labels. When the window contains no
   * closed lead the all-time figure is used instead: reporting "0% win rate" for
   * a workspace with plenty of won deals, solely because none were entered in
   * the last 30 days, is a worse answer than saying which cohort is shown.
   */
  const windowClause = dateMatchFor(Lead, req.query);
  const createdRange = windowClause ? windowClause.created : null;
  const hasWindow = Boolean(createdRange);

  const inWindow = (date) => {
    if (!createdRange) return true;

    const time = new Date(date).getTime();

    if (Number.isNaN(time)) return false;
    if (createdRange.$gte && time < new Date(createdRange.$gte).getTime()) return false;
    if (createdRange.$lte && time > new Date(createdRange.$lte).getTime()) return false;

    return true;
  };

  let wonCount = 0;
  let lostCount = 0;
  let wonValue = 0;

  if (hasWindow) {
    for (const lead of leads) {
      const stage = STAGE_ORDER.includes(lead.salesStage) ? lead.salesStage : 'New';

      if (!CLOSED_STAGES.has(stage) || !inWindow(lead.created)) continue;

      if (stage === 'Won') {
        wonCount += 1;
        wonValue += numberOrZero(lead.total) || offerMaxByLead.get(String(lead._id)) || 0;
      } else {
        lostCount += 1;
      }
    }
  }

  let winRateScope = 'all-time';

  if (hasWindow && wonCount + lostCount > 0) {
    winRateScope = 'window';
  } else if (hasWindow) {
    wonCount = allWonCount;
    lostCount = allLostCount;
    wonValue = allWonValue;
  } else {
    wonCount = allWonCount;
    lostCount = allLostCount;
    wonValue = allWonValue;
  }

  /* The monthly projection: the next six months, with unscheduled pipeline in
   * its own bucket rather than being attributed to a month nobody chose. */
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

  /*
   * Document pipeline that is not already represented by a lead. Quotes have no
   * lead link, and an offer whose lead is outside this account's lead scope
   * cannot be attached to anything in this forecast. Neither has a follow-up
   * date, so both sit in the unscheduled line of the projection.
   */
  const documentPipelineValue = documentOfferValue + quoteValue;
  const documentWeightedValue =
    documentOfferValue * OFFER_PROBABILITY + quoteValue * QUOTE_PROBABILITY;
  const documentCommitValue = documentOfferValue * OFFER_PROBABILITY;

  unscheduled.rawValue += documentPipelineValue;
  unscheduled.weightedValue += documentWeightedValue;

  const pipelineValue = leadPipelineValue + documentPipelineValue;
  const weightedValue = leadWeightedValue + documentWeightedValue;
  const commitValue = leadCommitValue + documentCommitValue;

  // Historical documents, bounded by the header window when one is selected.
  const [orderRow] = await Order.aggregate([
    {
      $match: windowedScopeFor(Order, req, { status: { $ne: 'cancelled' } }),
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
      $match: windowedScopeFor(Invoice, req, { status: { $ne: 'cancelled' } }),
    },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]).exec();

  const closedCount = wonCount + lostCount;
  const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;

  // Average deal size: the won average when those leads carry a value, else the
  // open pipeline's. A workspace whose closed leads were entered without a
  // monetary figure should not read "0 average" while its live deals have real
  // values.
  const averageDealSize =
    wonValue > 0 && wonCount > 0
      ? wonValue / wonCount
      : openCount > 0
        ? leadPipelineValue / openCount
        : 0;

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
        // The forecast itself is live; only outcomes and booked documents use
        // the range. The UI states this so a reader does not assume the
        // pipeline figure changed because the header did.
        appliesTo: 'closed outcomes and booked documents',
      },
      kpis: {
        pipelineValue,
        weightedValue,
        commitValue,
        bestCaseValue: pipelineValue,
        leadPipelineValue,
        documentPipelineValue,
        documentWeightedValue,
        documentCommitValue,
        winRate,
        winRateScope,
        averageDealSize,
        openCount,
        wonCount,
        lostCount,
        wonValue,
        bookedRevenue: invoiceRow?.total ?? 0,
        orderValue: orderRow?.total ?? 0,
      },
      stages: STAGE_ORDER.map((stage) => stageTotals.get(stage)),
      months: [...months, unscheduled],
      topOpportunities,
      sources: {
        leadValue: leadPipelineValue,
        offerValue,
        offerCount,
        quoteValue,
        quoteCount,
        orderValue: orderRow?.total ?? 0,
        orderCount: orderRow?.count ?? 0,
        bookedRevenue: invoiceRow?.total ?? 0,
        invoiceCount: invoiceRow?.count ?? 0,
        documentValue: documentPipelineValue,
      },
    },
    message: 'Successfully calculated the sales forecast',
  });
};

module.exports = { summary, STAGE_PROBABILITIES };
