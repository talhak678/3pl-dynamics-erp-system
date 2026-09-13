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
 * No list of module keys is duplicated here, deliberately. Callers pass the key
 * they care about, so there is nothing in this file to keep in sync with the
 * server's MODULE_KEYS.
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
