const { resolveModules, moduleForEntity } = require('../utils/moduleList');

/**
 * The read-only verbs. Everything the router exposes under an entity that only
 * ever reads: `create`, `update` and `delete` are deliberately absent, along
 * with `summary` - a summary is the module's own dashboard figure, not a lookup
 * another module needs.
 *
 * Defined by verb rather than as a list of the two endpoints a dropdown happens
 * to call today, so a form that reaches for listAll or filter instead of list
 * is not a second, quieter version of the same bug.
 */
const READ_ONLY_ACTIONS = new Set(['read', 'list', 'listAll', 'search', 'filter']);

/**
 * Entities whose read endpoints any authenticated account may call, whatever
 * modules it holds.
 *
 * Every entry is here for the same reason: a form belonging to some OTHER
 * module has to fill a picker from it, so gating that read on this entity's own
 * grant means a child account cannot use a page it is otherwise entitled to -
 * a 403 on a dropdown. That is the shape of all three:
 *
 *   taxes             the invoice, quote, offer and order forms each fetch the
 *                     tax list to build their selector.
 *   productcategory   the product form fetches the category list for its
 *                     category picker (see pages/Product/config.js).
 *   expensecategory   the expense form does the same (pages/Expense/config.js).
 *
 * The permission being enforced on these reads was "may configure taxes" / "may
 * configure categories", and reading a rate or a category name to put on a
 * record is not configuring anything.
 *
 * Only the read is opened. `create`, `update` and `delete` still go through the
 * full check below, so an account without the module cannot add a tax, change a
 * rate, add a category or rename one - it can only see what already exists,
 * which it could already see as soon as it put one on a record it was allowed to
 * make.
 *
 * Deliberately a written list rather than derived from "is this entity
 * referenced by another module's form", because that question has no cheap
 * answer and the wrong guess in the other direction silently reopens the bug.
 * Adding an entity here is a decision to make deliberately.
 *
 * What does NOT belong here: people, company, client and lead. Those are not
 * reference data - they are the CRM's own records, each with a module and a read
 * scope of its own - and opening their reads would let an account holding one
 * module browse another module's content, which is the opposite of what this
 * guard is for. A picker on those is a question about permissions, not about
 * lookups.
 */
const SHARED_REFERENCE_ENTITIES = new Set(['taxes', 'productcategory', 'expensecategory']);

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
  // so the first segment is the entity and the second the action:
  // /api/invoice/list -> 'invoice', 'list'.
  const [entity, action] = (req.path || '').split('/').filter(Boolean);

  // A reference entity's read endpoints are open to any signed-in account. The
  // account is already authenticated by the time this runs, so this widens who
  // may read a tax rate, not who may reach the API at all.
  if (SHARED_REFERENCE_ENTITIES.has(entity) && READ_ONLY_ACTIONS.has(action)) return next();

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
