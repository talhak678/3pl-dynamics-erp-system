const OWNER_FIELD = 'createdBy';

// Keys that must never be accepted from client query params, because they
// would let a caller widen or override the tenant isolation filter.
const RESERVED_FILTER_KEYS = ['createdBy', 'removed'];

const ownerFilter = (req) => ({ [OWNER_FIELD]: req.admin._id });

const isReservedFilterKey = (key) => RESERVED_FILTER_KEYS.includes(key);

module.exports = { OWNER_FIELD, RESERVED_FILTER_KEYS, ownerFilter, isReservedFilterKey };
