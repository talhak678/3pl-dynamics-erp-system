const {
  ADMIN_ROLES,
  ASSIGNABLE_ROLES,
  RETIRED_ROLES,
  DEFAULT_MEMBER_ROLE,
  isAssignableRole,
} = require('../../utils/roles');

/**
 * Validates a `role` submitted to /api/team.
 *
 * The rule is a denylist of two rather than an allowlist: a Customer Admin may
 * assign any role except 'owner' and 'superadmin'. Those two are refused because
 * they are the values other parts of the system *authorise* on - 'owner' opens
 * the tenancy gate, 'superadmin' the control plane - so an endpoint that let a
 * tenant set them would be an escalation path rather than a labelling one.
 *
 * Everything else is a job title that nothing branches on, so accepting it is
 * purely descriptive and there is nothing to protect.
 *
 * The second argument covers the one case the denylist above gets wrong: an
 * account whose title this product has retired. Those are absent from
 * ASSIGNABLE_ROLES, so a request that carries one is refused - and the edit form
 * carries one whenever it saves a member whose title it did not offer, which
 * means a retired account could not have its name or status changed without its
 * job title being changed too. `unchangedFrom` is the current value on the
 * account being edited: when the request repeats it exactly, nothing is being
 * handed out and there is nothing to refuse. See updateMember.js, which is the
 * only caller that passes it.
 *
 * Returns `{ value }` on success or `{ error, status }` on refusal, matching the
 * shape permissions.js uses for modules so the two read the same at the call
 * site.
 */
const validateRequestedRole = (requested, { unchangedFrom } = {}) => {
  // Absent means "not stated", not "no role". Defaulting here rather than
  // falling through to the schema default matters: the schema defaults to
  // 'owner', so a create that simply omitted the field would mint a tenant
  // owner out of an oversight.
  if (requested === undefined || requested === null || requested === '') {
    return { value: DEFAULT_MEMBER_ROLE };
  }

  if (typeof requested !== 'string' || requested.trim() === '') {
    return { error: 'role must be a non-empty string', status: 400 };
  }

  const role = requested.trim();

  if (isAssignableRole(role)) {
    return { value: role };
  }

  // A retired title, restated unchanged. Deliberately narrowed to RETIRED_ROLES
  // rather than "anything equal to the current value": that wider rule would
  // also accept a member already carrying 'owner' or 'superadmin', and those two
  // are refused unconditionally - an account that somehow has one should not be
  // able to have it written back through this endpoint. The gate is meant to be
  // the only thing that reads 'owner', and leaving a second writer in place for
  // the no-op case would make that harder to keep true.
  if (role === unchangedFrom && RETIRED_ROLES.includes(role)) {
    return { value: role };
  }

  // A real role that a tenant may not hand out, kept separate from the unknown
  // case below because the two are different mistakes and deserve different
  // answers: this one is an escalation attempt and is refused outright, while an
  // unrecognised string is a typo the caller can fix. Collapsing them into one
  // message would tell a caller probing for 'owner' the same thing it tells
  // someone who mistyped 'Manger'.
  if (ADMIN_ROLES.includes(role)) {
    return {
      error: `You cannot assign the role "${role}".`,
      status: 403,
    };
  }

  return {
    error: `Unknown role "${role}". Choose one of: ${ASSIGNABLE_ROLES.join(', ')}.`,
    status: 400,
  };
};

module.exports = { validateRequestedRole };
