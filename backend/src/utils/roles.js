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
 * This is the whole set the tenant UI offers and the whole set /api/team will
 * accept. The frontend carries a mirror with the module preset that goes with
 * each title (frontend/src/utils/rolePresets.js), and the two must be kept in
 * step: a title here with no preset there would be assignable but would tick
 * nothing, which reads to an admin as a broken form rather than a missing
 * default.
 */
const ASSIGNABLE_ROLES = [
  'employee',
  'Sales Executive',
  'Accountant',
  'Marketing Manager',
  'Inventory Manager',
  'Customer Support',
];

/**
 * Titles this product no longer offers, but which accounts already carry.
 *
 * Deliberately still in ADMIN_ROLES and deliberately NOT in ASSIGNABLE_ROLES.
 * That split is the whole point: `isAssignableRole` reads the list above, so
 * none of these can be handed to anyone new, while the schema enum still
 * accepts them - so an existing member carrying one can still be saved.
 *
 * Without this they would be orphaned rather than retired. The enum is checked
 * on every write, so the next time an admin edited such a member's name the
 * whole save would fail validation, on a field the admin never touched, with no
 * way to fix it except changing that person's job title. 'Digital Marketer' was
 * added deliberately (commit 8cc3d2d7), so accounts carrying it are likely
 * rather than hypothetical.
 *
 * 'admin' is here for a different reason: the API accepted it as a title but the
 * tenant UI never offered it. It was never a privilege level - no gate in this
 * codebase reads it.
 */
const RETIRED_ROLES = ['admin', 'Digital Marketer', 'Manager'];

/** The full enum the Admin schema accepts. */
const ADMIN_ROLES = [...SYSTEM_ROLES, ...ASSIGNABLE_ROLES, ...RETIRED_ROLES];

/**
 * The one assignable role that narrows a data scope rather than only labelling
 * an account.
 *
 * Everything else in ASSIGNABLE_ROLES is a job title nothing branches on, but a
 * Sales Executive sees a restricted slice of the tenant's leads (see
 * middlewares/ownership.js). The string is named here so the comparison and the
 * dropdown option cannot drift: it is stored Title-Cased with a space, so a
 * mistyped comparison would not error - it would quietly fail to match, and the
 * account would fall back to the WIDER tenant view instead of the narrower one.
 * That is a fail-open mistake, which is why it gets a constant.
 */
const SALES_EXECUTIVE_ROLE = 'Sales Executive';

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
  RETIRED_ROLES,
  ADMIN_ROLES,
  SALES_EXECUTIVE_ROLE,
  DEFAULT_MEMBER_ROLE,
  isAssignableRole,
};
