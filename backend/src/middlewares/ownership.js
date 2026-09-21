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
 */
const userFilter = (Model, req) => {
  if (!isTenantOwner(req && req.admin)) return {};

  if (!Model || !Model.schema || !Model.schema.path(USER_FIELD)) return {};

  const requested = req && req.query ? req.query[USER_FILTER_PARAM] : undefined;

  if (!requested || !OBJECT_ID_PATTERN.test(String(requested))) return {};

  return { [USER_FIELD]: requested };
};

module.exports = {
  OWNER_FIELD,
  USER_FIELD,
  USER_FILTER_PARAM,
  RESERVED_FILTER_KEYS,
  ownerFilter,
  leadFilter,
  userFilter,
  tenantIdOf,
  isSalesExecutive,
  isTenantOwner,
  isReservedFilterKey,
};
