import dayjs from 'dayjs';

/**
 * What each date-range choice means, and the window it covers.
 *
 * Kept out of the component and out of the hook so the arithmetic is one
 * readable function that can be reasoned about on its own - the boundaries here
 * are the whole feature, and an off-by-one-day is invisible on screen but wrong
 * in every figure on the page.
 *
 * Every window ends at the end of today rather than at "now". A record entered
 * this afternoon has to be inside a range that includes today, and `endOf('day')`
 * is what makes today's own numbers appear while the day is still running.
 */

/** The four choices, in the order the dialog offers them. */
export const DATE_RANGE_PRESETS = ['daily', 'monthly', 'yearly', 'custom'];

/**
 * Monthly, on first load and after a reset.
 *
 * The dashboard's cards are mostly money in and money out, and a month is the
 * span those are read over. A day is too thin to show a trend and a year too
 * coarse to notice one, so the middle option is the one worth defaulting to.
 */
export const DEFAULT_DATE_RANGE_PRESET = 'monthly';

/**
 * Supplied rather than left to `translate()`.
 *
 * `translate()` only replaces underscores and title-cases, so it would render
 * these correctly but would also mean the preset names live in two places. The
 * strings are plain English here, which is what every un-translated string in
 * this app already is.
 */
export const PRESET_LABELS = {
  daily: 'Daily',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

/**
 * The span each preset names, spelled out for the dialog's secondary line and
 * for the button's own label, so what was chosen is readable without opening
 * the dialog again.
 */
export const PRESET_DESCRIPTIONS = {
  daily: "Today's date",
  monthly: 'Last 30 days',
  yearly: 'Last 12 months',
  custom: 'Choose a start and end date',
};

/** How many days 'monthly' covers, counting today. */
const MONTHLY_WINDOW_DAYS = 30;

/** How many months 'yearly' covers, counting the current one. */
const YEARLY_WINDOW_MONTHS = 12;

/**
 * The window a preset covers, as dayjs values, or null when there is not one.
 *
 * A `from`/`to` pair that is incomplete, unparseable or the wrong way round
 * returns null rather than a guessed window - and every caller treats null as
 * "no window", which queries everything. The dialog refuses to apply such a
 * pair in the first place, so null is a guard rather than an expected state, and
 * the direction it fails in is the one that shows too much rather than the one
 * that hides real records.
 *
 * `now` is a parameter so the arithmetic can be pinned to a fixed instant in a
 * test rather than depending on when it runs.
 */
export const rangeForPreset = (preset, custom, now = dayjs()) => {
  switch (preset) {
    case 'daily':
      return { startDate: now.startOf('day'), endDate: now.endOf('day') };

    case 'yearly':
      return {
        startDate: now.subtract(YEARLY_WINDOW_MONTHS, 'month').startOf('day'),
        endDate: now.endOf('day'),
      };

    case 'custom': {
      if (!custom || !custom.from || !custom.to) return null;

      const from = dayjs(custom.from);
      const to = dayjs(custom.to);

      if (!from.isValid() || !to.isValid()) return null;

      // A backwards range is not a range. Asking the server for it would return
      // nothing at all, which reads as "you have no data" rather than as a
      // mistake in the dialog.
      if (from.isAfter(to, 'day')) return null;

      return { startDate: from.startOf('day'), endDate: to.endOf('day') };
    };

    case 'monthly':
    default:
      // 29 days back, so the window is today plus the 29 before it: 30 days
      // counting today, which is what "last 30 days" means to a reader.
      return {
        startDate: now.subtract(MONTHLY_WINDOW_DAYS - 1, 'day').startOf('day'),
        endDate: now.endOf('day'),
      };
  }
};

/**
 * The entities a date window means anything for.
 *
 * Must match DATED_MODELS in backend/src/utils/dateRange.js, lowercased - the
 * same mirroring convention SALES_EXECUTIVE_ROLE and WORKSPACE_OWNER_ROLE
 * already use for backend/src/utils/roles.js. The server remains the authority
 * on whether the window is applied; this list only decides which tables bother
 * re-fetching when it moves, and the two must not drift: a module named on the
 * server but missing here would keep its old rows until the reader navigated
 * away and back, which reads as the filter half-working.
 *
 * What is left out is the catalogue - Product, ProductCategory, ExpenseCategory,
 * Taxes and PaymentMode - and the absence of those is the reason this gate
 * exists rather than re-fetching everywhere. The header's control is rendered on
 * every page, so an ungated re-fetch would reload those tables, and drop them
 * back to page one, on a filter the server ignores for them entirely.
 *
 * Client, Company, People and Order are here because the module checklist
 * requires a range on those screens. Those four models declare no business date,
 * so the server windows them on `created`; the invoice, quote, offer and payment
 * lists are windowed on their own `date` instead.
 *
 * Shipment is here because the server lists it, though no screen shows one yet.
 */
export const DATED_ENTITIES = Object.freeze([
  'client',
  'company',
  'expense',
  'invoice',
  'lead',
  'offer',
  'order',
  'payment',
  'people',
  'quote',
  'shipment',
]);

/** Whether a window applies to this entity's list at all. */
export const isDatedEntity = (entity) =>
  DATED_ENTITIES.includes(String(entity ?? '').toLowerCase());

/**
 * The window as a single value a fetch effect can compare, or '' for none.
 *
 * This is what a table puts in its dependency array. It exists as a named
 * function rather than as two inline `dateQuery.startDate` entries so the gate
 * is testable on its own and cannot be forgotten in one of the two tables that
 * need it.
 *
 * A string rather than the query object because React compares dependencies with
 * Object.is: `selectDateRangeQuery` is memoised and does keep a stable identity,
 * but a string compares by value and so also survives the query being rebuilt
 * with the same two bounds. Re-applying the range already in force therefore
 * produces an identical key and no re-fetch.
 *
 * Empty for an undated entity whatever the window - a constant, so those tables
 * never re-run on a range change - and empty when there is no window, which is
 * the state the helpers return for an incomplete custom range.
 */
export const tableWindowKey = (entity, query) => {
  if (!isDatedEntity(entity)) return '';

  const start = query && query.startDate;
  const end = query && query.endDate;

  return start && end ? `${start}|${end}` : '';
};

/**
 * A window as the two query parameters the summaries take, or {} for no window.
 *
 * ISO instants rather than 'YYYY-MM-DD'. The day boundary is already decided by
 * rangeForPreset, and an instant carries it: sending a bare date would make the
 * server guess which end of the day an `endDate` means, and the two ends need
 * opposite guesses. ISO also survives the trip unambiguously because the server
 * reads it back with `new Date()`, so the window means the same absolute span
 * whatever timezone either end is in.
 *
 * Only rendered as query parameters when there is a window, because
 * request.summary concatenates every option it is handed - an undefined one
 * would be sent as the literal string 'undefined'.
 */
export const rangeToQuery = (range) =>
  range
    ? {
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
      }
    : {};

/**
 * Whether a `from`/`to` pair is complete and the right way round.
 *
 * The dialog reads this to decide whether Custom can be applied. Same question
 * rangeForPreset answers by returning null, asked separately so the dialog can
 * say why rather than just refusing.
 */
export const isCustomRangeValid = (custom) =>
  Boolean(custom && custom.from && custom.to && dayjs(custom.from).isValid() && dayjs(custom.to).isValid() && !dayjs(custom.from).isAfter(dayjs(custom.to), 'day'));

/**
 * How a chosen range reads on the button and in the dialog.
 *
 * The dates are shown for Custom only. A preset already says what it covers in
 * its own name - 'Monthly (Last 30 days)' - and repeating the two dates would
 * take more room on the button to say less.
 */
export const describeRange = (preset, custom) => {
  if (preset !== 'custom') return PRESET_DESCRIPTIONS[preset] || '';

  if (!isCustomRangeValid(custom)) return PRESET_DESCRIPTIONS.custom;

  return `${dayjs(custom.from).format('DD/MM/YYYY')} - ${dayjs(custom.to).format('DD/MM/YYYY')}`;
};
