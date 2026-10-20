/**
 * The single client-side source of truth for module permissions.
 *
 * Both the sidebar filter (apps/Navigation/NavigationContainer.jsx) and the
 * route guard (router/RequireModule.jsx) read permissions through here, so the
 * two can never disagree about who may see what.
 *
 * This mirrors resolveModules() in backend/src/utils/moduleList.js. The server
 * already resolves the list before sending it — authUser.js returns
 * resolveModules(user) in the login payload — and treats an empty or absent list
 * as every module. The client applies the identical rule.
 *
 * Gating decisions take the key they are asked about, so nothing in this file
 * can grant or deny a module by being out of date. The single exception is
 * ALL_MODULES, which exists only to answer "is anything missing?" — see below.
 */

/**
 * The granted module keys, or null when the account is unrestricted.
 *
 * "Absent" is a live case rather than a defensive one. localStorage['auth']
 * outlives a deployment, so a tenant who was already signed in when permissions
 * shipped holds a session written before the login payload carried
 * modulePermissions. Reading that undefined as "nothing granted" would lock them
 * out of their own ERP until they logged out and back in — the same lockout the
 * backend guard is careful to avoid.
 */
export const resolveModules = (admin) => {
  const permissions = admin?.modulePermissions;
  return Array.isArray(permissions) && permissions.length > 0 ? permissions : null;
};

/** Whether the signed-in account may use a module. */
export const hasModule = (admin, moduleKey) => {
  const granted = resolveModules(admin);
  return granted === null || granted.includes(moduleKey);
};

/**
 * Whether a roadmap parent was granted explicitly, rather than inherited from
 * the "empty means everything" default.
 *
 * The four roadmap parents - Purchase & Suppliers, POS, Operations, Website &
 * E-Commerce - have no implemented child, so there is no working module to infer
 * their visibility from. Their own key is the only signal. It has to be read
 * from the STORED list (`storedModulePermissions`, sent by the server alongside
 * the resolved one), because the resolved list expands an empty stored list to
 * every key and would make the roadmaps appear on every unrestricted account.
 *
 * A session that predates this field has no stored copy at all. It reads as "not
 * granted", which hides the roadmaps until the session refreshes - ErpApp
 * dispatches refreshSession on load, and /auth/me now returns the field - or,
 * if that request fails, until the next sign-in. Hiding is the safe direction:
 * an account that never asked for POS does not suddenly get it.
 *
 * hasModule is checked as well so this can never report a grant the route guard
 * would refuse, even if a stale resolved list were merged over a newer stored one.
 */
export const hasExplicitModule = (admin, moduleKey) => {
  const stored = admin?.storedModulePermissions;
  return Array.isArray(stored) && stored.includes(moduleKey) && hasModule(admin, moduleKey);
};

/**
 * Every grantable module. Mirrors MODULE_KEYS in backend/src/utils/moduleList.js,
 * which is the authority.
 *
 * This is the one list in this file, and it earns its place: the dashboard has to
 * decide whether to raise the upgrade notice, and "are any modules missing?"
 * cannot be answered without knowing the total. Nothing else reads it — every
 * gating decision still takes the key it is asked about — so drift here cannot
 * grant or deny anything. The worst it can do is misjudge that one notice: too
 * long and everyone sees it, too short and nobody does.
 *
 * Keep it in step with the server if MODULE_KEYS ever changes. It changed once
 * already: 'report' was dropped, because it had no page, no route and no
 * navigation entry — the Dashboard Summary Report PDF is served from an ungated
 * route and 'dashboard' is what covers the report pages.
 */
export const ALL_MODULES = [
  'dashboard',
  'invoice',
  'payment',
  'quote',
  'customer',
  'people',
  'company',
  'lead',
  'offer',
  'product',
  'category/product',
  'order',
  'expenses',
  'category/expenses',
  'generalSettings',
  'taxes',
  'help',

  // The three Sales & CRM sub-modules. Additive: every key above is unchanged,
  // so an account whose stored array predates this feature keeps every grant it
  // had. Mirrors the same three additions in backend/src/utils/moduleList.js.
  'sales_followups',
  'sales_targets',
  'sales_forecasting',

  // The four roadmap parents. They are grantable so an administrator can choose
  // whether a wholly-placeholder group is drawn; they gate no page or API. The
  // sidebar reads them from the STORED list only (see hasExplicitModule), which
  // is what keeps them hidden when an empty stored list means "everything".
  'purchase_group',
  'pos_group',
  'operations_group',
  'website_group',
];

/**
 * The roadmap keys - grantable checkboxes that reveal a parent, not a module.
 *
 * Used only by isMissingModules below. Counting them as missing capabilities
 * would raise the dashboard's upgrade notice for an account that already holds
 * every implemented module, simply because it never ticked a group that has
 * nothing behind it yet.
 */
export const ROADMAP_MODULES = [
  'purchase_group',
  'pos_group',
  'operations_group',
  'website_group',
];

/**
 * Whether the account holds fewer modules than exist — the condition for the
 * dashboard's upgrade notice.
 *
 * An account with no allow-list at all is unrestricted rather than empty, so it
 * is never "missing" anything and must not be nagged. That is the same
 * empty-means-everything rule resolveModules applies, and the same one the
 * server's guard applies.
 */
export const isMissingModules = (admin) => {
  const granted = resolveModules(admin);
  if (granted === null) return false;

  // Roadmap keys are excluded from both sides: they reveal a placeholder group
  // and grant no capability, so an account holding every implemented module but
  // no roadmap group is complete, not restricted.
  const implemented = (key) => !ROADMAP_MODULES.includes(key);

  return granted.filter(implemented).length < ALL_MODULES.filter(implemented).length;
};
