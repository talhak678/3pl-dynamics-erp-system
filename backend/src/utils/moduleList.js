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

/**
 * Maps an app-API entity to the module key that governs it.
 *
 * The entity names are the `entity` values in routes/appRoutes/appApi.js, which
 * are derived from the filenames in models/appModels. They are NOT the same
 * strings as the module keys, and the four that differ are not guessable:
 *
 *   client          -> customer             (the Customer page's entity is 'client')
 *   expense         -> expenses
 *   expensecategory -> category/expenses
 *   productcategory -> category/product
 *
 * The mapping is written out by hand rather than derived, because a wrong entry
 * fails in both directions: too strict and a tenant loses a module they paid
 * for, too loose and the guard silently stops enforcing.
 *
 * Three entities are deliberately absent, and requireModuleAccess lets them
 * through:
 *
 *   employee, shipment  no page under frontend/src/pages owns them, so no
 *                       module key exists that could gate them.
 *   paymentmode         its navigation entry is commented out in
 *                       NavigationContainer.jsx, so no module covers it.
 *
 * Note that 'setting' is absent too, and for a different reason: it belongs to
 * coreApi, not the app API, and gating it would break the application rather
 * than a module — see requireModuleAccess for why.
 */
const ENTITY_MODULE_MAP = {
  invoice: 'invoice',
  quote: 'quote',
  payment: 'payment',
  client: 'customer',
  people: 'people',
  company: 'company',
  lead: 'lead',
  offer: 'offer',
  product: 'product',
  productcategory: 'category/product',
  order: 'order',
  expense: 'expenses',
  expensecategory: 'category/expenses',
  taxes: 'taxes',
};

/** The module governing an entity, or null when no module covers it. */
const moduleForEntity = (entity) => ENTITY_MODULE_MAP[entity] ?? null;

module.exports = { MODULE_KEYS, resolveModules, isValidModuleKey, moduleForEntity };
