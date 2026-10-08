/**
 * The date window the dashboard asked for.
 *
 * The dashboard's cards are the callers - the money and document summaries, and
 * since the sales analytics cards were brought under the same control, the
 * leads list they are counted from. They send `startDate` and `endDate` as ISO
 * instants and this turns them into a clause to be ANDed with the tenant scope.
 * Everything here reads exactly those two query params and nothing else, and
 * nothing here builds a scope of its own - the scope is built by the caller and
 * handed in - so no change to this file can widen what an account is able to
 * see. See withDateWindow, which is where that guarantee is actually made.
 *
 * Nothing here is applied unless a caller asks for it. A request carrying
 * neither param gets the same clause it got before this existed, which is what
 * keeps the older field-specific `type` preset below working unchanged - and
 * what leaves the offer form's lead picker, which shares the leads listAll
 * endpoint with the pipeline board, reading every lead exactly as it did
 * before. The pipeline board now sends the params and is windowed; the picker
 * is not a list screen and still asks for nothing.
 */

/**
 * What a window is measured against, asked of the schema rather than assumed.
 *
 * `date` where the model has a real Date at that name, because that is the
 * document's own business date and what a person reading a money card means by
 * "last 30 days" - an invoice dated last month belongs in last month's figures
 * whether it was entered then or today. It is also the field the summary
 * methods' own commented-out date clauses named, so this is the intent that was
 * there all along rather than a new decision.
 *
 * `created` for a model with no business date, which is every model that
 * records something rather than issuing a document - a client, a product. Those
 * have only the moment they were entered.
 *
 * The field is tested for being a Date rather than merely present, so a model
 * that happens to carry a string field called `date` is not compared against a
 * Date and silently matched nothing.
 */
const FALLBACK_DATE_FIELD = 'created';

const dateFieldFor = (Model) => {
  const path = Model && Model.schema && Model.schema.path('date');

  return path && path.instance === 'Date' ? 'date' : FALLBACK_DATE_FIELD;
};

/**
 * A query value as an instant, or null when there is nothing usable in it.
 *
 * An unparseable value is treated as absent rather than refused. The dashboard
 * always sends both bounds, so arriving here with nonsense means a hand-made
 * request, and answering that with the unfiltered summary is exactly what the
 * same request would have received before this feature existed.
 */
const parseBound = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * The window as a `$match` clause, or null when no window was asked for.
 *
 * Both ends are inclusive. The caller is expected to send day boundaries rather
 * than a date at midnight - the dashboard sends local start-of-day and
 * end-of-day instants - because a bare `endDate` of '2026-09-30' would
 * otherwise exclude everything recorded on the 30th, which is not what somebody
 * choosing that date means. Deliberately not rounded up here: this takes the
 * instants it is given, so a caller that wants one exact moment can ask for it
 * and not get a whole day.
 *
 * Exported because the client summary has a facet whose window is a preset when
 * no explicit one was sent, and it needs to ask the same question the same way
 * rather than reimplement the parsing.
 */
const dateMatchFor = (Model, query) => {
  const start = parseBound(query && query.startDate);
  const end = parseBound(query && query.endDate);

  if (!start && !end) return null;

  const range = {};

  if (start) range.$gte = start;
  if (end) range.$lte = end;

  return { [dateFieldFor(Model)]: range };
};

/**
 * The clause a dashboard read starts from: whatever scope the caller passed,
 * and the requested window, ANDed.
 *
 * Named for the window rather than for summaries, because it is now reached
 * from both: an aggregation `$match` in the money and document summaries, and a
 * plain query filter in the leads listAll. It answers the same question in both
 * - "the caller's scope, narrowed to the window if one was asked for" - so one
 * function serves both rather than two that could come to disagree.
 *
 * `$and` rather than one spread object, and this is the part that matters for
 * isolation. What the callers pass is not always flat - a child account's
 * narrowing is an `$or` over authorship and assignment (see
 * middlewares/ownership.js), and one of them carries a `paymentStatus: {$in}`
 * clause - so returning a single object with the date beside it would put two
 * clauses as siblings whose combination relies on the keys not colliding. As
 * separate `$and` entries neither can displace or widen the other: the scope
 * keeps meaning exactly what it meant before, and the window can only remove
 * rows from it.
 *
 * That makes the window narrowing-only by construction, which is the property
 * worth having: an account cannot reach a record it could not already see by
 * choosing a date range, and a window that matches nothing returns nothing
 * rather than everything. A child account asking for a year gets a year of its
 * own leads, never the workspace's.
 *
 * `removed: false` is baked in because every read in this family has it; the
 * rest is the caller's, so the shape of each scope stays visible at the call
 * site rather than being reassembled here.
 *
 * The window is always its own trailing entry, never merged into a condition
 * the caller passed, so a caller can hand in a clause about the same date field
 * without the two overwriting each other - they would intersect, which is the
 * only safe way for them to combine.
 */
const withDateWindow = (Model, req, ...conditions) => {
  const clauses = [{ removed: false }, ...conditions.filter(Boolean)];

  const dateMatch = dateMatchFor(Model, req && req.query);

  if (dateMatch) clauses.push(dateMatch);

  return { $and: clauses };
};

/*
 * The models a date window is meaningful for.
 *
 * Named rather than derived, because the derivation available is a lie here:
 * dateFieldFor() falls back to `created` for any model without a business date,
 * which would make a "Today" filter return the products, taxes, payment modes
 * and categories *created* today and nothing else. Every one of those screens
 * would look empty, and the report would be that the date filter broke the
 * catalogue.
 *
 * So the window is opt-in per model, and this set is the whole of the policy.
 * Every list controller that applies a window asks through datedWindowFor, so
 * this Set and not the controller is what decides - a name added here and
 * nowhere else still does nothing until its controller asks, and a controller
 * that asks for a name missing from here gets null and quietly shows
 * everything.
 *
 * Shipment is in it because it declares a business date, though no screen lists
 * one yet.
 *
 * Client, Company, People and Order are in it because the module checklist
 * requires a range on those screens. None of the four declares a business date,
 * so all four window on `created` - the moment the record was entered. On a
 * customer that is "added in the range" rather than "dated in the range", which
 * is the only reading the schema supports; an invoice or a quote does have a
 * business date and is windowed on that instead, so the two families answer
 * subtly different questions over the same control.
 *
 * The catalogue is deliberately absent: Product, ProductCategory,
 * ExpenseCategory, Taxes and PaymentMode are all things a workspace sets up
 * once and then lists in full, and hiding half a list of categories behind a
 * range no one associates with them is the bug the Set exists to prevent.
 *
 * The field is `created`. Never `createdAt` - these schemas declare their own
 * `created` and `updated` and carry no Mongoose timestamps, so a clause on
 * `createdAt` matches no document at all and every list reads empty.
 */
const DATED_MODELS = new Set([
  'Client',
  'Company',
  'Expense',
  'Invoice',
  'Lead',
  'Offer',
  'Order',
  'Payment',
  'People',
  'Quote',
  'Shipment',
]);

/**
 * The date clause for this model, or null when the model is not one a window
 * applies to.
 *
 * Returning null rather than an empty object matters: every caller pushes the
 * result onto an `$and` only when it is truthy, so `{}` would add a clause that
 * matches everything and quietly turn a filtered list into an unfiltered one on
 * any model it reached.
 *
 * Takes the same req the ownership filters take, so the window is built from the
 * same query string and sits beside them as its own `$and` entry - which is what
 * makes it narrowing-only. See withDateWindow.
 *
 * Note `req.query` rather than `req`: dateMatchFor reads the query, not the
 * request, and passing the request here would read `req.startDate` - undefined -
 * and return null on every call, silently disabling the filter everywhere.
 */
const datedWindowFor = (Model, req) => {
  if (!Model || !DATED_MODELS.has(Model.modelName)) {
    return null;
  }

  return dateMatchFor(Model, req && req.query);
};

module.exports = {
  dateMatchFor,
  withDateWindow,
  dateFieldFor,
  datedWindowFor,
  DATED_MODELS,
};
