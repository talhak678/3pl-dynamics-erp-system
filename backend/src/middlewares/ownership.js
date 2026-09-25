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
 * Every model in SCOPED_MODEL_NAMES carries it, so "this person's rows" is
 * genuinely two questions and a filter that answered only one of them would read
 * as a broken filter: a record assigned to a colleague was never theirs to
 * enter, so a test of authorship alone hides everything that person is actually
 * working - which is the thing an owner opens this filter to look at. See
 * userFilter.
 *
 * Still asked of the schema rather than assumed, so a model that gains or loses
 * the field stays honest without this file being edited. A model without it is
 * one the assignee half cannot describe, and it degrades to the authorship
 * clause alone rather than to a query that means something else.
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
 * Whether this account is a child of the workspace it is signed in to - that is,
 * everyone except the account that owns it.
 *
 * This is the predicate the whole isolation model turns on. It is written as
 * "not the owner" rather than as a list of employee titles because the titles
 * are open-ended: roles.js documents every assignable title except Sales
 * Executive as a label nothing branches on, and an account may carry a retired
 * title ('employee', 'Manager', 'Customer Support') that no current list would
 * name. Enumerating the child titles would therefore leak data to exactly the
 * accounts whose titles had drifted, which is the failure mode hardest to
 * notice. Asking the one question that has a stable answer - are you the owner -
 * fails the other way, and the other way is closed.
 *
 * The isSuperAdmin exclusion is not decoration, and mirrors isSalesExecutive's.
 * A super admin owns no tenant: tenantIdOf resolves to their own id and their
 * queries already match nothing. But the control plane's accounts are not
 * tenant children and must not be pulled into a tenant-shaped clause at all.
 * Every branch below falls through to plain ownerFilter for them, so the Super
 * Admin portal behaves exactly as it did before this mechanism existed.
 */
const isChildUser = (admin) =>
  Boolean(admin) && admin.isSuperAdmin !== true && admin.role !== 'owner';

/**
 * The scope for Lead queries: the tenant, narrowed to the caller's own leads
 * when the caller is a child account.
 *
 * Deliberately a separate function rather than a change to ownerFilter.
 * ownerFilter is spread into roughly forty query sites across every entity in
 * the app, so widening its meaning would silently rescope invoices, quotes,
 * payments and clients at the same time. Only the models named in
 * SCOPED_MODEL_NAMES opt in to this - and since Lead is the one that needed it
 * first, this predates the rest of that list. Today it resolves to exactly what
 * scopedFilter gives Lead; it is kept because Lead's read paths are overridden
 * one by one and pinning their scope to a shared controller would be a worse
 * trade than one duplicated wrapper. See leadController/filter.js.
 *
 * Two clauses, matching the requirement that an account keeps sight of records
 * it created as well as ones handed to it:
 *
 *   assignedTo     it was assigned to them to work
 *   createdByUser  they entered it, and reassigning it to a colleague should
 *                  not make it vanish from the person who typed it in
 *
 * `createdByUser` exists because `createdBy` cannot serve here: it holds the
 * TENANT id, not the acting account's (see leadController/create.js). For a
 * child account those two ids differ, so a test of `createdBy === req.admin._id`
 * could never be true and the "created by me" half of the rule would be dead
 * code.
 *
 * Note the top-level `createdBy` still applies, ANDed with the $or - so this
 * narrows within the tenant and can never widen beyond it.
 */
const leadFilter = (req) => {
  const admin = req && req.admin;
  const base = ownerFilter(req);

  if (!isChildUser(admin)) return base;

  return {
    ...base,
    ...assignmentClause(admin, true, true),
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
 * The entities a child account's read scope narrows.
 *
 * Named explicitly rather than inferred from "the schema has a createdByUser
 * path", because those are not the same set and the difference is load-bearing
 * in both directions:
 *
 *   - Product and ProductCategory carry tenancy fields but must stay global.
 *     They are the catalogue every account works from; an inventory manager who
 *     could only see products they had personally entered would have an empty
 *     picker and no way to fill it.
 *   - Taxes, PaymentMode, Employee and Shipment are deliberately absent. The
 *     first two are reference data that the Invoice, Quote, Offer and Payment
 *     forms fetch to populate their own pickers, and those forms have no
 *     "assign to" control to delegate them with - so narrowing them would empty
 *     a picker on a form the child account is otherwise entitled to use, and
 *     break document creation outright. Employee and Shipment are entities with
 *     no page, no navigation entry and no call site anywhere in the frontend.
 *
 * Keeping the set a written decision rather than a consequence of which schemas
 * happen to carry a column is the point: adding a field to a model should never
 * silently enrol it in tenant-wide data narrowing.
 */
const SCOPED_MODEL_NAMES = [
  'Client',
  'Company',
  'People',
  'Lead',
  'Offer',
  'Quote',
  'Invoice',
  'Payment',
  'Order',
  'Expense',
  'ExpenseCategory',
];

const isScopedModel = (Model) =>
  Boolean(Model) && SCOPED_MODEL_NAMES.includes(Model.modelName);

/**
 * The "mine, or handed to me" clause, built from the paths the model actually
 * has.
 *
 * A model carrying both paths gets the $or the requirement describes. A model
 * carrying only one gets that clause alone, so nothing answers with a different
 * kind of query than it can honour. A model carrying neither - which a scoped
 * name should never be, since every one of them declares `createdByUser` - gets
 * a clause that matches nothing rather than an empty object. That direction is
 * the whole point: an empty object would mean "no narrowing", which for a child
 * account is a tenant-wide read, so a schema mistake would fail open into a data
 * leak. `_id` is used because it exists on every schema, so Mongoose keeps the
 * clause instead of stripping it in strict mode.
 */
const assignmentClause = (admin, hasUserField, hasAssigneeField) => {
  const clauses = [];

  if (hasUserField) clauses.push({ [USER_FIELD]: admin._id });
  if (hasAssigneeField) clauses.push({ [ASSIGNEE_FIELD]: admin._id });

  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return { $or: clauses };

  return { _id: { $in: [] } };
};

/**
 * The narrowing a child account reads a scoped entity through: the records it
 * created, plus the ones assigned to it.
 *
 * Returns {} - meaning "no narrowing" - for the workspace owner, for a super
 * admin, and for every entity outside SCOPED_MODEL_NAMES. The owner returning {}
 * is the requirement that the Customer Admin sees everything, and it is why this
 * composes with ownerFilter rather than replacing it.
 *
 * This is the successor to the Sales-Executive-only contact narrowing these
 * three lines replaced. The rule it implements is broader in two ways at once -
 * every child account rather than one title, and every scoped entity rather than
 * the three contact models - so a single function answering both is what keeps
 * the two from drifting apart. See scopedFilter, its only caller.
 */
const assignmentFilter = (Model, req) => {
  const admin = req && req.admin;

  if (!isChildUser(admin)) return {};

  if (!isScopedModel(Model)) return {};

  if (!Model.schema) return {};

  return assignmentClause(
    admin,
    Boolean(Model.schema.path(USER_FIELD)),
    Boolean(Model.schema.path(ASSIGNEE_FIELD))
  );
};

/**
 * The tenant clause and the per-account narrowing together, for the methods that
 * serve more than one entity.
 *
 * The shared CRUD methods are reached by every model, so they cannot call
 * ownerFilter and assignmentFilter separately without each one having to know
 * which models narrow. Composing them here keeps those call sites a single
 * token, and makes the pairing itself the thing under test.
 *
 * Identical to ownerFilter for the workspace owner, for a super admin, and for
 * every model outside SCOPED_MODEL_NAMES - assignmentFilter returns {} in all
 * three cases, so the spread adds nothing.
 *
 * Composition warning for callers: a narrowed model contributes a top-level
 * `$or`, and so does a text search (`fields`) and userFilter. Two `$or` keys in
 * one object cannot coexist - the later spread replaces the earlier - so any
 * call site that combines this with another $or must compose through `$and`
 * instead of spreading both. See createCRUDController/paginatedList.js and
 * leadController/paginatedList.js for the two shapes that do it.
 */
const scopedFilter = (Model, req) => ({
  ...ownerFilter(req),
  ...assignmentFilter(Model, req),
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
 * top-level `$or`, and so do assignmentFilter and a text search. Two `$or` keys
 * in one object cannot coexist - the later spread replaces the earlier - so a
 * call site that combines this with either must push each as its own `$and`
 * entry rather than spreading both into one object. Every model in
 * SCOPED_MODEL_NAMES now carries the field, so every one of their list
 * endpoints needs that treatment; leadController/paginatedList.js was the first
 * and createCRUDController/paginatedList.js follows the same shape.
 */
const userFilter = (Model, req) => {
  if (!isTenantOwner(req && req.admin)) return {};

  if (!Model || !Model.schema || !Model.schema.path(USER_FIELD)) return {};

  const requested = req && req.query ? req.query[USER_FILTER_PARAM] : undefined;

  if (!requested || !OBJECT_ID_PATTERN.test(String(requested))) return {};

  // Both questions, where the model can answer both. A model with no assignee
  // keeps the single-clause shape, so nothing that does not record assignment
  // starts answering with a different kind of query.
  //
  // Product and ProductCategory are the two models that land here, and their
  // shape is the point of this branch. They record authorship but no assignee,
  // because the catalogue is shared and there is nothing to hand from one person
  // to another - so the owner's filter means "who entered this", and nothing
  // else. Neither is in SCOPED_MODEL_NAMES, so this is the only clause they ever
  // gain: the base query stays tenant-wide, every child account keeps seeing the
  // whole catalogue, and the filter removes rows for the owner alone. That is
  // the difference between a filter and isolation, and it is decided by which
  // list a model's name appears in, not by which fields it happens to carry.
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
  SCOPED_MODEL_NAMES,
  ownerFilter,
  leadFilter,
  assignmentClause,
  assignmentFilter,
  scopedFilter,
  userFilter,
  tenantIdOf,
  isSalesExecutive,
  isScopedModel,
  isChildUser,
  isTenantOwner,
  isReservedFilterKey,
};
