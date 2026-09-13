const { resolveModules, moduleForEntity } = require('../utils/moduleList');

/**
 * Enforces modulePermissions on the app API (routes/appRoutes/appApi.js — the
 * invoice, quote, payment, client, product … entity routes).
 *
 * Without this, modulePermissions is only a rendering hint: the frontend hides
 * the menu entry, and a tenant who types the URL reaches the module anyway with
 * every endpoint still answering. This is the part that makes the permission
 * real.
 *
 * Mounted router-wide, so it runs only AFTER adminAuth.isValidAuthToken, which
 * is applied at the app level ahead of this router and is what populates
 * req.admin. It does no token parsing of its own.
 *
 * Scope is deliberately the app entities only. The core API (/admin/*,
 * /setting/*) is not gated here, and that is a decision rather than an
 * oversight:
 *
 *   - /setting/* serves currency, date format and company details, which every
 *     module needs to render at all. It is fetched once at app start by
 *     ErpApp.jsx; refusing it leaves a tenant staring at a broken shell rather
 *     than a blocked module.
 *   - generalSettings and taxes share those same endpoints and are told apart
 *     only by settingKey, so a path-based guard cannot separate them.
 *
 * The consequence is that those two modules remain UI-only. Everything with its
 * own entity is enforced.
 */
const requireModuleAccess = (req, res, next) => {
  const admin = req.admin;

  // Super admins are control-plane operators and own no tenant data, so the
  // tenant module model does not describe them. What they may do is governed by
  // requireSuperAdmin instead. This also means a super admin cannot be used to
  // test this guard — use a tenant account.
  if (admin && admin.isSuperAdmin === true) return next();

  // Inside this router req.path is relative to the /api mount it is attached to,
  // so the first segment is the entity: /api/invoice/list -> 'invoice'.
  const entity = (req.path || '').split('/').filter(Boolean)[0];
  const moduleKey = moduleForEntity(entity);

  // An entity no module covers (see ENTITY_MODULE_MAP) is allowed through.
  // Refusing it would mean inventing a mapping and blocking requests the
  // product never scoped to a module in the first place.
  if (!moduleKey) return next();

  // resolveModules treats an empty or absent list as every module, which is what
  // keeps accounts created before modulePermissions existed working. Applying
  // the same rule here is what stops this guard from locking out every
  // pre-existing tenant the moment it ships — the login payload and this check
  // can never disagree about what an empty list means.
  const granted = resolveModules(admin);

  if (granted.includes(moduleKey)) return next();

  // The module key is echoed back so the failure is diagnosable from the
  // response alone; the frontend's errorHandler surfaces `message` as a toast.
  return res.status(403).json({
    success: false,
    result: null,
    message: `Your account does not have access to the ${moduleKey} module.`,
    module: moduleKey,
  });
};

module.exports = requireModuleAccess;
