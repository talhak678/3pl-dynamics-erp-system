// The grantable access units, taken from the `key:` values in
// frontend/src/apps/Navigation/NavigationContainer.jsx so the client can gate
// its menu on these strings without a translation layer.
//
// This list is the "all modules" set, so anything omitted here is not merely
// ungrantable — it is invisible to every account that relies on the default.
// Two entries in that navigation file are deliberately left out, and a client
// rendering the menu has to account for both:
//
//   - 'settingsMenu' is the Settings container, not a module; it grants nothing
//     on its own. Render the group whenever ANY of its children
//     (generalSettings, taxes, help) is granted.
//   - 'paymentMode' appears there only inside a commented-out block, so it is
//     not a live navigation item.
const MODULE_KEYS = [
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
 * An empty or absent allow-list means every module. This is what lets accounts
 * created before modulePermissions existed inherit the default without a write
 * to their document.
 */
const resolveModules = (admin) => {
  if (admin && Array.isArray(admin.modulePermissions) && admin.modulePermissions.length > 0) {
    return admin.modulePermissions;
  }
  return MODULE_KEYS;
};

const isValidModuleKey = (key) => MODULE_KEYS.includes(key);

module.exports = { MODULE_KEYS, resolveModules, isValidModuleKey };
