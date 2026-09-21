import { hasModule } from './modulePermissions';

/**
 * Who may open the Sales Pipeline, in one place.
 *
 * The sidebar entry and the route guard both ask this question, and they must
 * never disagree: an entry shown to someone the route then refuses is a dead
 * link, and a route open to someone the sidebar hides is a module nobody knows
 * exists. Both read canUseSalesPipeline() for the same reason
 * utils/modulePermissions.js is read by both - one predicate, two callers.
 *
 * This mirrors the backend, where the same two conditions decide what the API
 * will return: middlewares/requireModuleAccess.js resolves the path to the
 * `lead` module, and middlewares/ownership.js narrows the rows by role. Unlike
 * RequireOwner, nothing here is the enforcement - the server re-derives both
 * from the token. This only decides what is drawn.
 */

/** Must match SALES_EXECUTIVE_ROLE in backend/src/utils/roles.js. */
export const SALES_EXECUTIVE_ROLE = 'Sales Executive';

/** Must match the `owner` entry in backend/src/utils/roles.js. */
export const WORKSPACE_OWNER_ROLE = 'owner';

/**
 * The module key the pipeline is built on.
 *
 * There is no separate `salesPipeline` key and there should not be one: every
 * endpoint behind this page is /api/lead/*, which the backend guard already
 * resolves to `lead`. Inventing a second key would mean a page that the menu
 * considers granted and the API refuses, and it would need an entry adding to
 * three hand-maintained module mirrors.
 *
 * The consequence, stated plainly: this page is a second view of the leads an
 * account can already reach, not a new grant. Anyone given `lead` who is also
 * one of the two roles below sees it, and nobody else does.
 */
export const SALES_PIPELINE_MODULE = 'lead';

/**
 * Whether the account holds one of the two roles the pipeline is for.
 *
 * A job title, not a grant - which is exactly why the module check below is
 * separate rather than folded in. `role` cannot be handed out by ticking a box,
 * and `modulePermissions` cannot express "only the two roles that work leads".
 * The page needs both answers.
 *
 * isSuperAdmin is excluded for the same reason as everywhere else: a super
 * admin owns no workspace, so there is no pipeline of theirs to show. They hold
 * `owner`-like reach in the control plane, not here.
 */
export const isPipelineRole = (admin) =>
  admin?.isSuperAdmin !== true &&
  (admin?.role === WORKSPACE_OWNER_ROLE || admin?.role === SALES_EXECUTIVE_ROLE);

/**
 * Whether the account may see the Sales Pipeline, and so whether the sidebar
 * entry is built for it at all.
 *
 * Both conditions are required. The role check alone would show the page to a
 * Sales Executive the owner never granted `lead` - the menu would offer a view
 * whose every request comes back 403. The module check alone would show it to
 * any employee granted `lead`, which is precisely who must not have it.
 */
export const canUseSalesPipeline = (admin) =>
  isPipelineRole(admin) && hasModule(admin, SALES_PIPELINE_MODULE);

/**
 * The modules a Sales Executive needs to do the job, ticked automatically when
 * that role is chosen in User Management.
 *
 * Four keys, not five. The obvious fifth - a `salesPipeline` module - does not
 * exist and must not be invented here: the pipeline is a second view of `lead`,
 * served by /api/lead/*, which the backend guard already resolves to that key.
 * Listing a key the server does not know would make the whole save fail with
 * "Unknown module key(s)", so a convenience prefilled with it would break the
 * form it was meant to speed up. See SALES_PIPELINE_MODULE above.
 *
 * A default, not a rule. The admin can untick any of these or add others - the
 * server's only constraint is that they grant nothing they do not hold
 * themselves (see teamController/permissions.js), which is why the caller
 * filters this list against what it may grant before applying it.
 */
export const SALES_EXECUTIVE_MODULES = ['dashboard', SALES_PIPELINE_MODULE, 'customer', 'quote'];
