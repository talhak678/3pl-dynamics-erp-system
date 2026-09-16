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
 * Keep it in step with the server if MODULE_KEYS ever changes.
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
  'report',
  'generalSettings',
  'taxes',
  'help',
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
  return granted !== null && granted.length < ALL_MODULES.length;
};
