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

module.exports = { OWNER_FIELD, RESERVED_FILTER_KEYS, ownerFilter, tenantIdOf, isReservedFilterKey };
