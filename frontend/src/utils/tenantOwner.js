import { WORKSPACE_OWNER_ROLE } from './salesPipeline';

/**
 * Whether this account is the Customer Admin — the tenant that owns the
 * workspace it is signed into.
 *
 * Both halves are load-bearing, and both are easy to half-copy:
 *
 *   role === 'owner'
 *     The Customer Admin. `role` grants nothing by itself anywhere in this
 *     codebase; it is read here because "is this the account that pays for the
 *     workspace" genuinely is a question about the account's job title, and no
 *     other field answers it. The backend gate that decides the same question,
 *     middlewares/requireTenantOwner.js, reads the same field for the same
 *     reason and is the only place where the answer is enforced rather than
 *     merely consulted.
 *
 *   isSuperAdmin !== true
 *     Excluded explicitly rather than left implied. A super admin operates the
 *     control plane and owns no tenant, so there is no workspace of theirs to be
 *     the admin of — and every other tenant-scoped predicate in the app draws
 *     the line in the same place (utils/salesPipeline.js, and the local copy in
 *     hooks/useAssigneeDirectory.js). Written as `!== true` so a missing or
 *     malformed field denies instead of allows, matching the strictness of the
 *     backend guards.
 *
 * Dropping the first test silently widens the answer to every employee; dropping
 * the second is invisible until a control-plane account is signed in, and then
 * it hands them a workspace they do not own. Hence one named function rather
 * than a fifth inline copy of the expression.
 *
 * hooks/useAssigneeDirectory.js exports canReadTeamDirectory, which is this same
 * test under the name of one of its consequences. Left as it is rather than
 * folded in here: the sales pipeline reads it, and rewriting a predicate two
 * unrelated features depend on is not worth it to save three lines.
 */
export const isTenantOwner = (admin) =>
  admin?.role === WORKSPACE_OWNER_ROLE && admin?.isSuperAdmin !== true;
