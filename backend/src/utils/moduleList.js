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
//
// 'report' used to be a key here and is not any more: it never had a page, a
// route or a navigation entry. The Dashboard Summary Report PDF it was named
// after is served from /api/report/*, which is ungated because no entity maps
// to it either - so dropping the key costs nothing and stops a permission that
// granted nothing from being handed out. 'dashboard' is what covers the report
// pages. An account still carrying 'report' in its stored modulePermissions is
// unaffected: an unknown string in that array grants nothing and gates nothing.
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
  'generalSettings',
  'taxes',
  'help',

  // The three Sales & CRM sub-modules added alongside the grouped navigation.
  //
  // They are ordinary grantable keys, not navigation-only markers: each has a
  // page, a route and API endpoints, so granting one grants something. The
  // sidebar's ten parent modules are a rendering hierarchy, not a second
  // permission layer - a parent has no key of its own and is shown when at
  // least one of its children is held.
  //
  // Every pre-existing key above is unchanged, which is what makes accounts
  // saved before this feature keep working: their stored arrays are still
  // entirely valid, and the new keys are additive.
  'sales_followups',
  'sales_targets',
  'sales_forecasting',
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

  // The three new Sales & CRM modules. The entity names are derived from the
  // model filenames by models/utils, so they are `followup` for FollowUp.js and
  // `salestarget` for SalesTarget.js. `salesforecast` is not a model - it is
  // the aggregation endpoint mounted explicitly in routes/appRoutes/appApi.js -
  // but it still arrives at requireModuleAccess with that first path segment, so
  // it needs an entry here for the same reason the others do.
  followup: 'sales_followups',
  salestarget: 'sales_targets',
  salesforecast: 'sales_forecasting',
};

/** The module governing an entity, or null when no module covers it. */
const moduleForEntity = (entity) => ENTITY_MODULE_MAP[entity] ?? null;

module.exports = { MODULE_KEYS, resolveModules, isValidModuleKey, moduleForEntity };
