const { SALES_EXECUTIVE_ROLE } = require('../utils/roles');

const OWNER_FIELD = 'createdBy';

// Keys that must never be accepted from client query params, because they
// would let a caller widen or override the tenant isolation filter.
const RESERVED_FILTER_KEYS = ['createdBy', 'removed'];

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

module.exports = {
  OWNER_FIELD,
  RESERVED_FILTER_KEYS,
  ownerFilter,
  leadFilter,
  tenantIdOf,
  isSalesExecutive,
  isReservedFilterKey,
};
