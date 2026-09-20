/**
 * The roles an Admin account can carry, and which of them a tenant may hand out.
 *
 * One list, imported by both the Admin schema (which enforces it as the `enum`)
 * and the team controllers (which enforce it as an assignment rule). Keeping
 * them together is the point: if the schema and the guard held separate copies,
 * the drift would be silent in the dangerous direction - a value the guard
 * allowed but the schema rejected would surface as a Mongoose ValidationError,
 * i.e. a 500 on a request the caller was told was fine.
 *
 * Roles are labels, not permissions. Nothing in this codebase grants module
 * access from `role`; that is `modulePermissions`, resolved by
 * utils/moduleList.js. The two places `role` is actually read are the tenancy
 * gate (requireTenantOwner, which requires exactly 'owner') and its frontend
 * mirror (RequireOwner / NavigationContainer), and both compare against a
 * literal rather than deriving anything from this list.
 */

/**
 * Control-plane and tenancy roles. Never assignable through /api/team.
 *
 * 'owner' is what requireTenantOwner checks, and crucially it is also what makes
 * an account a tenant in its own right. Handing it out would let an employee
 * pass the owner gate and then create accounts parented to themselves - a
 * sub-tenant the original owner cannot see or administer.
 *
 * 'superadmin' is what requireSuperAdmin checks. Note the two gates are not
 * interchangeable: requireTenantOwner refuses isSuperAdmin outright, so a super
 * admin carrying role 'owner' still cannot reach the team endpoints.
 */
const SYSTEM_ROLES = ['owner', 'superadmin'];

/**
 * Everything a Customer Admin may assign to someone in their own workspace.
 *
 * Stored Title-Cased with spaces because these are job titles shown verbatim in
 * the UI, not identifiers - nothing branches on them, so their shape is a
 * presentation choice rather than an API contract.
 *
 * 'admin' is accepted by the API but is not offered by the tenant UI (see
 * MemberFormDrawer). It is a title here, not a privilege level: no gate in this
 * codebase reads it, so selecting it confers nothing beyond the label. It is
 * assignable only because the rule is a denylist of two, not an allowlist of
 * four - narrowing that would be a product decision, not a security one.
 */
const ASSIGNABLE_ROLES = [
  'employee',
  'admin',
  'Sales Executive',
  'Digital Marketer',
  'Manager',
];

/** The full enum the Admin schema accepts. */
const ADMIN_ROLES = [...SYSTEM_ROLES, ...ASSIGNABLE_ROLES];

/**
 * What a member gets when the request omits a role.
 *
 * 'employee' rather than the schema default of 'owner' - inheriting the schema
 * default here would mint a tenant owner from a request that simply forgot the
 * field.
 */
const DEFAULT_MEMBER_ROLE = 'employee';

const isAssignableRole = (role) => ASSIGNABLE_ROLES.includes(role);

module.exports = {
  SYSTEM_ROLES,
  ASSIGNABLE_ROLES,
  ADMIN_ROLES,
  DEFAULT_MEMBER_ROLE,
  isAssignableRole,
};
