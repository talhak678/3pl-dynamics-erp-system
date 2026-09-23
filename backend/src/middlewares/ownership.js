const { SALES_EXECUTIVE_ROLE } = require('../utils/roles');

const OWNER_FIELD = 'createdBy';

/**
 * The field the per-user filter matches on, and the query param that carries the
 * choice.
 *
 * `createdByUser` is authorship, which is a different question from ownership:
 * `createdBy` holds the tenant every row in the workspace shares, so filtering on
 * it could only ever return all of a tenant's rows or none. Only models that
 * actually record authorship carry this field - see userFilter, which refuses to
 * apply to a model that does not.
 */
const USER_FIELD = 'createdByUser';
const USER_FILTER_PARAM = 'user';

/**
 * The field that records who a record was handed to, where a model has one.
 *
 * Only Lead carries it. It is here because "this person's rows" is genuinely two
 * questions and a filter that answers only one of them reads as a broken filter:
 * a lead assigned to a colleague was never theirs to enter, so a test of
 * authorship alone hides every lead that person is actually working - which is
 * the thing an owner opens this filter to look at. See userFilter.
 *
 * A model without it is one the assignee half cannot describe, and asking the
 * schema rather than assuming keeps that honest as models gain and lose the
 * field.
 */
const ASSIGNEE_FIELD = 'assignedTo';

// Keys that must never be accepted from client query params, because they
// would let a caller widen or override the tenant isolation filter.
//
// 'createdByUser' is listed so that authorship is reachable through exactly one
// parameter: the `user` one below, which userFilter gates by role. Reaching it
// through `filter=` instead would work on the same terms as any other field -
// narrowing only, never widening - but it would do so for child accounts too,
// and a field whose whole purpose is an owner-only view should have one way in.
const RESERVED_FILTER_KEYS = ['createdBy', 'createdByUser', 'removed'];

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * The account whose data this request may touch.
 *
 * An owner's tenant is themselves; an employee's is the account that created
 * them. Without this an employee would resolve to their own id, match nothing,
 * and work in an empty workspace of their own instead of their employer's.
 *
 * Written against the two stored fields rather than reading the Admin model's
 * `tenantId` virtual, so it also holds for the plain objects that reach here
 * from tests and from the report controller's stand-in request. It never
 * returns undefined: an admin with neither field falls back to `_id`, and a
 * missing admin yields null. That matters more than it looks — `createdBy:
 * undefined` in a Mongo filter matches every document with no `createdBy`, so
 * an unguarded undefined here would not fail closed, it would return the whole
 * collection across every tenant.
 */
const tenantIdOf = (admin) => {
  if (!admin) return null;
  return admin.parentAdminId || admin._id || null;
};

const ownerFilter = (req) => ({ [OWNER_FIELD]: tenantIdOf(req && req.admin) });

const isReservedFilterKey = (key) => RESERVED_FILTER_KEYS.includes(key);

/**
 * Whether this account is a Sales Executive, and so sees a narrowed slice of
 * its workspace's leads rather than all of them.
 *
 * The isSuperAdmin exclusion is not decoration. A super admin owns no tenant,
 * so tenantIdOf resolves to their own id and their queries already match
 * nothing; but roles.js also lists 'Sales Executive' as assignable, and a
 * control-plane account that happened to carry it must not be pulled into a
 * tenant-shaped clause. Super admin behaviour is unchanged by this whole
 * mechanism - every branch below falls through to plain ownerFilter for them.
 */
const isSalesExecutive = (admin) =>
  Boolean(admin) && admin.isSuperAdmin !== true && admin.role === SALES_EXECUTIVE_ROLE;

/**
 * The scope for Lead queries: the tenant, narrowed to the caller's own leads
 * when the caller is a Sales Executive.
 *
 * Deliberately a separate function rather than a change to ownerFilter.
 * ownerFilter is spread into roughly forty query sites across every entity in
 * the app, so widening its meaning would silently rescope invoices, quotes,
 * payments and clients at the same time - a change nothing asked for and one
 * that would be very hard to notice. Only the lead controllers opt in to this.
 *
 * Two clauses, matching the requirement that an executive keeps sight of leads
 * they created as well as ones assigned to them:
 *
 *   assignedTo     the lead is theirs to work
 *   createdByUser  they entered it, and reassigning it to a colleague should
 *                  not make it vanish from the person who typed it in
 *
 * `createdByUser` exists because `createdBy` cannot serve here: it holds the
 * TENANT id, not the acting account's (see leadController/create.js). For an
 * executive those two ids differ, so a test of `createdBy === req.admin._id`
 * could never be true and the "created by me" half of the rule would be dead
 * code.
 *
 * Note the top-level `createdBy` still applies, ANDed with the $or - so this
 * narrows within the tenant and can never widen beyond it.
 */
const leadFilter = (req) => {
  const admin = req && req.admin;
  const base = ownerFilter(req);

  if (!isSalesExecutive(admin)) return base;

  return {
    ...base,
    $or: [{ assignedTo: admin._id }, { createdByUser: admin._id }],
  };
};

/**
 * Whether this account owns the workspace it is signed in to.
 *
 * The isSuperAdmin exclusion mirrors isSalesExecutive's: a control-plane account
 * owns no tenant, so this filter has nothing to offer it and must not be applied
 * on its behalf.
 */
const isTenantOwner = (admin) =>
  Boolean(admin) && admin.isSuperAdmin !== true && admin.role === 'owner';

/**
 * The three entities a Sales Executive's read scope narrows.
 *
 * Named rather than inferred, because "has a createdByUser path" is not the same
 * set: Offer carries the field too, and narrowing it was not asked for. Testing
 * the model by name keeps the narrowed set a decision someone made rather than a
 * consequence of which schemas happen to carry a column.
 */
const CONTACT_MODEL_NAMES = ['Client', 'Company', 'People'];

const isContactModel = (Model) =>
  Boolean(Model) && CONTACT_MODEL_NAMES.includes(Model.modelName);

/**
 * The scope for the three contact entities: the tenant, narrowed to the
 * executive's own records when the caller is a Sales Executive.
 *
 * The reported behaviour was that an employee saw every Customer, Company and
 * People record the admin had ever entered. These three were the gap: Lead was
 * already narrowed by leadFilter, but nothing else was, so a Sales Executive's
 * contact lists were the whole workspace's.
 *
 * Authorship only - `createdByUser` - and deliberately without the second half
 * of leadFilter's rule. That half matches records reached through a lead
 * assigned to the caller, and it cannot be expressed here for the reason the
 * model does not carry: a Lead references a Company and a People, but nothing
 * references a Client at all, and no controller converts a lead into one. So
 * "customers tied to my leads" has no path to travel. Authorship is the one
 * relation all three entities actually record, and using it for all three keeps
 * their behaviour identical rather than subtly different per entity.
 *
 * Scoped to Sales Executives because that is the only role this codebase
 * narrows - see roles.js, which documents every other assignable title as a
 * label nothing branches on. An accountant still sees every client, which is
 * what keeps invoicing workable; a role-wide narrowing here would empty the
 * client picker in the Invoice and Quote forms for anyone who did not
 * personally enter the customer.
 */
const contactFilter = (Model, req) => {
  const admin = req && req.admin;

  if (!isSalesExecutive(admin)) return {};

  if (!isContactModel(Model)) return {};

  if (!Model.schema || !Model.schema.path(USER_FIELD)) return {};

  return { [USER_FIELD]: admin._id };
};

/**
 * The tenant clause and the contact narrowing together, for the methods that
 * serve more than one entity.
 *
 * The shared CRUD methods are reached by every model, so they cannot call
 * ownerFilter and contactFilter separately without each one having to know which
 * models narrow. Composing them here keeps those call sites a single token, and
 * makes the pairing itself the thing under test.
 *
 * Identical to ownerFilter for every account that is not a Sales Executive and
 * for every model that is not one of the three - contactFilter returns {} in
 * both cases, so the spread adds nothing.
 */
const scopedFilter = (Model, req) => ({
  ...ownerFilter(req),
  ...contactFilter(Model, req),
});

/**
 * The "show me only this person's rows" scope for a list query, or {} when there
 * is nothing to narrow by.
 *
 * Owner-only, and that is the whole of the isolation story here. A child account
 * passing ?user=<someone else> gets {} back, so the clause is never even built -
 * their request keeps exactly the scope ownerFilter (or leadFilter) gives it.
 * The dropdown is hidden for them in the UI, but this is the half that makes it
 * true rather than merely unrendered.
 *
 * The narrowed id is ANDed with the tenant clause at the call site, never
 * substituted for it, so an id belonging to another workspace matches nothing
 * rather than reaching across. That is also why the id is not resolved against
 * the team list first: the tenant clause is what makes it safe, and a lookup
 * would add a round trip to every page of results to prove something the query
 * already proves.
 *
 * A malformed id is ignored rather than rejected, which leaves the caller with
 * their whole workspace - the same result as passing nothing, and the same
 * result a tampered parameter deserves. No data crosses a boundary either way.
 *
 * Takes the Model because it only applies to entities that record authorship. A
 * model without the field is one this filter cannot describe, and matching it
 * against an absent path would silently return no rows at all - a table that
 * looks empty rather than one that looks unfiltered. Asking the schema is what
 * keeps this honest as models gain and lose the field.
 *
 * It matches authorship OR assignment, and that $or is the whole of the fix for
 * the reported behaviour. Authorship alone answered only half the question: a
 * lead assigned to someone was not entered by them, so selecting that person
 * listed the leads they had typed in and none of the ones they were actually
 * working - which is the opposite of what the filter is opened to see. Both
 * halves are wanted, so both are matched.
 *
 * This widens only within a tenant. The clause is ANDed with ownerFilter at
 * every call site and never substituted for it, so a match still has to belong
 * to the caller's workspace. That is what stops an id from another workspace
 * reaching across, and it is also why the id is not resolved against the team
 * list first: a lookup would add a round trip to every page of results to prove
 * something the tenant clause already proves.
 *
 * Composition note for whoever gives another model an assignee: this returns a
 * top-level `$or`, and createCRUDController/paginatedList.js spreads the result
 * into the same object as the text search's `$or`, where one would replace the
 * other. That is safe today only because Lead - the one model carrying the field
 * - has its own paginatedList, which pushes this clause as a separate $and entry
 * for precisely this reason. A second model with an assignee needs the same
 * treatment at its call site before this clause is correct for it.
 */
const userFilter = (Model, req) => {
  if (!isTenantOwner(req && req.admin)) return {};

  if (!Model || !Model.schema || !Model.schema.path(USER_FIELD)) return {};

  const requested = req && req.query ? req.query[USER_FILTER_PARAM] : undefined;

  if (!requested || !OBJECT_ID_PATTERN.test(String(requested))) return {};

  // Both questions, where the model can answer both. A model with no assignee
  // keeps the single-clause shape, so nothing that does not record assignment
  // starts answering with a different kind of query.
  if (Model.schema.path(ASSIGNEE_FIELD)) {
    return {
      $or: [{ [ASSIGNEE_FIELD]: requested }, { [USER_FIELD]: requested }],
    };
  }

  return { [USER_FIELD]: requested };
};

module.exports = {
  OWNER_FIELD,
  USER_FIELD,
  ASSIGNEE_FIELD,
  USER_FILTER_PARAM,
  RESERVED_FILTER_KEYS,
  CONTACT_MODEL_NAMES,
  ownerFilter,
  leadFilter,
  contactFilter,
  scopedFilter,
  userFilter,
  tenantIdOf,
  isSalesExecutive,
  isContactModel,
  isTenantOwner,
  isReservedFilterKey,
};
