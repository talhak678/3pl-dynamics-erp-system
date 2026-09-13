# Super Admin System — Design

**Date:** 2026-09-14
**Status:** Approved for implementation
**Scope:** Backend only. No frontend work in this change.

---

## 1. Context

The application is a multi-tenant ERP. As of commit `93da865a`, every business record carries a
`createdBy` ObjectId and every query in the generic CRUD layer plus all module overrides is scoped
by it. Data isolation between tenants is strict and unconditional.

There is currently no way to administer tenant accounts. Every admin has `role: 'owner'`, an enum
locked to that single value (`models/coreModels/Admin.js:30`), and there is no concept of an account
that sits above the tenant boundary.

This design adds a Super Admin tier whose job is **account administration only**. It deliberately
does *not* grant visibility into tenant business data, so the isolation guarantee remains
unconditional rather than becoming "isolated except for super admins".

## 2. Decisions

These were settled with the user before design work began.

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Can a Super Admin read tenant business data? | **No — control plane only** | Keeps `ownerFilter()` free of bypass branches. Every one of the 45 scoped files keeps a single behavior path. |
| D2 | How is "all modules" represented in `modulePermissions`? | **Empty array means all** | The 3 legacy users must inherit the default with zero database writes, so "all" has to be the absent/empty case. |
| D3 | How is the first Super Admin created? | **Secret-gated one-time route, then deleted** | The user's local network cannot reach MongoDB SRV, so an offline script is not runnable. Mirrors the `migrate-ownership` pattern already used successfully. |
| D4 | Fix the existing password-update privilege escalation? | **Yes, in scope** | Without it the Super Admin tier is bypassable by any tenant. See §8. |

## 3. Goals and non-goals

**Goals**

1. An admin account can be suspended such that it can neither log in nor use an existing session.
2. An admin account can be restricted to a subset of sidebar modules.
3. A Super Admin can list, create, suspend and re-permission tenant accounts.
4. The three existing legacy admins inherit correct defaults with **no** modification to their
   stored documents.
5. No new path exists by which a tenant can escalate to Super Admin.

**Non-goals**

- No frontend changes. The API contracts in §7 are what the frontend will be built against.
- No cross-tenant read access, no impersonation, no "log in as customer" support flow.
- No audit log of Super Admin actions.
- No password-reset-on-behalf-of-tenant endpoint.
- No deletion of tenant accounts (suspend only).

## 4. Schema changes

**File:** `backend/src/models/coreModels/Admin.js`

Add three fields. `role` and `enabled` are untouched.

```js
isActive: {
  type: Boolean,
  default: true,
},
isSuperAdmin: {
  type: Boolean,
  default: false,
},
modulePermissions: {
  type: [String],
  default: [],
},
```

### Why the legacy users need no migration

All three fields have defaults. Mongoose applies a default when a path is `undefined` on the
hydrated document, so an admin whose stored document lacks these fields reads back as
`isActive: true`, `isSuperAdmin: false`, `modulePermissions: []`. No write, no backfill, no script.
The stored documents remain byte-identical.

### The `enabled` / `isActive` overlap

`Admin` already has `enabled: { type: Boolean, default: false }`, checked in
`createAuthMiddleware/login.js:43`. That is a second, pre-existing kill switch.

Both are kept and both are honored, because:

- Repurposing `enabled` would require writing to the legacy users, violating goal 4.
- `enabled` defaults to `false`, so a newly created account that omits it cannot log in at all.
  The creation endpoint in §7.2 therefore sets **both** `enabled: true` and `isActive: true`, so a
  new tenant is never silently locked out by the older check.

A future change should consolidate these into one flag; that is out of scope here.

### Guard semantics

Every `isActive` check compares with `=== false`, never a falsy test:

```js
if (user.isActive === false) { /* 403 */ }
```

This is deliberate. A falsy check would treat a `null` or absent value as suspended and lock out any
document that somehow has the field unset. Checking for exactly `false` means only an explicit
suspension blocks access.

## 5. Module list

**New file:** `backend/src/utils/moduleList.js`

Follows the existing `utils/countryList.js`, `utils/currencyList.js` convention.

```js
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
];

// An empty or absent allow-list means every module.
const resolveModules = (admin) =>
  admin && Array.isArray(admin.modulePermissions) && admin.modulePermissions.length > 0
    ? admin.modulePermissions
    : MODULE_KEYS;

const isValidModuleKey = (key) => MODULE_KEYS.includes(key);

module.exports = { MODULE_KEYS, resolveModules, isValidModuleKey };
```

The keys are exactly the `key:` values in `frontend/src/apps/Navigation/NavigationContainer.jsx`,
so the frontend can gate on the same strings it already uses without a translation layer.

## 6. Guards

### 6.1 Login — `controllers/middlewaresControllers/createAuthMiddleware/login.js`

Immediately after the existing `if (!user.enabled)` check and before `authUser(...)` is called:

```js
if (user.isActive === false) {
  return res.status(403).json({
    success: false,
    result: null,
    message: 'Account suspended',
  });
}
```

No token is issued. The caller cannot obtain a session at all.

`login.js` also calls `ensureTenantSettings(user._id)`. That call is skipped when
`user.isSuperAdmin === true`, since a Super Admin owns no tenant data and seeding a settings set for
them is wasted work.

### 6.2 Per-request — `controllers/middlewaresControllers/createAuthMiddleware/isValidAuthToken.js`

After `user` is loaded and the `loggedSessions` check passes, before `req[reqUserName] = user`:

```js
if (user.isActive === false) {
  return res.status(403).json({
    success: false,
    result: null,
    message: 'Account suspended',
  });
}
```

This placement matters: it invalidates **live sessions**, not just new logins. Suspending a tenant
takes effect on their next request rather than whenever their 24h token happens to expire.

### 6.3 New — `backend/src/middlewares/requireSuperAdmin.js`

```js
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.isSuperAdmin !== true) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Forbidden',
    });
  }
  next();
};

module.exports = requireSuperAdmin;
```

This middleware does no token parsing of its own. It must always be mounted **after**
`adminAuth.isValidAuthToken`, which is what populates `req.admin`. It checks `!== true` rather than a
falsy test so a missing or malformed value denies rather than allows.

## 7. Super Admin API

### 7.1 Mounting

**File:** `backend/src/app.js`, alongside the existing `/api` mounts.

```js
const superAdminRouter = require('./routes/coreRoutes/superAdminApi');

app.use('/api/superadmin', adminAuth.isValidAuthToken, requireSuperAdmin, superAdminRouter);
```

The `/api/superadmin` prefix does not collide with `coreApiRouter` (`/setting/*`, `/admin/*`) or
`erpApiRouter` (the app entities).

**New file:** `backend/src/routes/coreRoutes/superAdminApi.js`

```js
router.route('/users').get(catchErrors(controller.listUsers));
router.route('/users').post(catchErrors(controller.createUser));
router.route('/users/:id/status').patch(catchErrors(controller.toggleUserStatus));
router.route('/users/:id/permissions').patch(catchErrors(controller.updateUserPermissions));
```

Super Admin accounts are control-plane and are **not** gated by `modulePermissions`.

### 7.2 `GET /api/superadmin/users` — `listUsers`

Returns every Admin document via an explicit field whitelist:

```js
{ _id, name, email, enabled, isActive, isSuperAdmin, modulePermissions, created }
```

**Never returned:** `password`, `salt`, `loggedSessions`, `resetToken`, `emailToken`, or any other
`AdminPassword` field. The whitelist is explicit rather than a document dump specifically so a future
schema addition cannot leak into this response by accident.

```json
{
  "success": true,
  "result": [ { "_id": "…", "name": "Talha Khan", "email": "demo1@3pldynamicsai.com",
                "enabled": true, "isActive": true, "isSuperAdmin": false,
                "modulePermissions": [], "created": "2026-09-13T…" } ],
  "message": "Successfully found all users"
}
```

The Super Admin's own account is included in this list.

### 7.3 `POST /api/superadmin/users` — `createUser`

**Body**

| Field | Required | Notes |
|---|---|---|
| `email` | yes | Validated as an email. 409 if already in use. |
| `password` | yes | Minimum 8 characters. |
| `name` | yes | Required — see note below. |
| `modulePermissions` | no | Array of known module keys. Omitted or `[]` means all modules. |

> **Deviation from the original brief.** The brief specified email, password and modulePermissions.
> `name` is added as a required field because `Admin.name` is `required: true`
> (`models/coreModels/Admin.js:21`) and the insert would otherwise fail validation. Deriving a name
> from the email local-part was rejected as producing poor data quality in a list view whose whole
> purpose is identifying accounts.

**Security rules**

- `isSuperAdmin` is **not** an accepted body field and is hardcoded to `false`. This endpoint cannot
  mint a second Super Admin. Any `isSuperAdmin` key in the request body is ignored.
- `enabled` and `isActive` are both set to `true`; neither is client-settable.
- `role` is left to the schema default (`'owner'`) and is not client-settable.
- The password is hashed with the project's existing flow:
  `salt = uniqueId()`, then `new AdminPassword().generateHash(salt, password)`, storing
  `{ password, salt, emailVerified: true, user }`. This is the same path used by `setup.js` and by
  the now-removed `setupDemos.js`.
- The account is created with **no** settings documents. `ensureTenantSettings` seeds their private
  settings copy on first login, per the isolation design.

**Responses:** `200` created · `400` validation failure or unknown module key · `409` email in use.

```json
{ "success": true,
  "result": { "_id": "…", "name": "…", "email": "…", "isActive": true,
              "isSuperAdmin": false, "modulePermissions": [] },
  "message": "User created successfully" }
```

### 7.4 `PATCH /api/superadmin/users/:id/status` — `toggleUserStatus`

**Body:** `{ "isActive": true | false }` — must be a boolean.

**Rules**

- `404` if no Admin exists with `:id`.
- `409` if `:id` equals `req.admin._id` — a Super Admin cannot suspend itself.

> Self-suspension is the only guard needed to guarantee the control plane never becomes
> unreachable. Because a Super Admin cannot suspend itself, after any sequence of suspensions at
> least one active Super Admin remains: consider A and B both active — if A suspends B, A cannot
> then suspend A. No separate "last Super Admin" check is required.

**Response:** `200` with the updated account in the same shape as §7.2's list entries.

### 7.5 `PATCH /api/superadmin/users/:id/permissions` — `updateUserPermissions`

**Body:** `{ "modulePermissions": ["invoice", "payment"] }`

- `404` if no Admin exists with `:id`.
- `400` if any key is not in `MODULE_KEYS`. The whole request is rejected; no partial write.
- `[]` is valid and means all modules (decision D2).

**Response:** `200` with the updated account.

### 7.6 Surfacing the caller's own permissions

`modulePermissions` is only useful if the signed-in tenant can read their own. The login response in
`createAuthMiddleware/authUser.js` currently returns
`{ _id, name, surname, role, email, photo, token, maxAge }`. Two fields are added:

```js
isSuperAdmin: user.isSuperAdmin === true,
modulePermissions: resolveModules(user),
```

`modulePermissions` is returned **resolved** — a restricted tenant gets their explicit allow-list, an
unrestricted one gets the full `MODULE_KEYS`. The frontend never has to reimplement the
"empty means all" rule from decision D2, and the two sides cannot drift.

`authUser.js` therefore needs `require('../../../utils/moduleList')`.

**Deliberate non-goal:** there is no `GET /api/admin/me` endpoint in this change. The frontend
persists the login payload locally, so a permission change made by a Super Admin takes effect on the
affected tenant's **next login**, not instantly. That is acceptable for a first version and avoids
adding a route and controller whose only purpose is a live refresh. If instant revocation is wanted
later it should be a small self-read endpoint, and the `isValidAuthToken` guard in §6.2 is the
precedent for how per-request checks are done here.

## 8. Fix: password-update privilege escalation

**File:** `backend/src/controllers/middlewaresControllers/createUserController/updatePassword.js`

**Current defect.** Line 37 writes:

```js
const resultPassword = await UserPassword.findOneAndUpdate(
  { user: req.params.id, removed: false },
  { $set: UserPasswordData },
  …
```

The target is `req.params.id` — the URL parameter — and it is never compared against the
authenticated caller. The route `PATCH /api/admin/password-update/:id` is registered at
`routes/coreRoutes/coreApi.js:16` behind nothing but a valid token. Any authenticated admin can
therefore reset **any other** admin's password to a value of their choosing. The only obstacle is a
hardcoded `admin@admin.com` email check at line 20. `userProfile` is read at line 8 and used only
for that email check and for the response message.

**Impact on this design.** Creating `superadmin@3pldynamicsai.com` without fixing this would place
the Super Admin behind a door that every existing tenant can open. The `requireSuperAdmin` guard in
§6.3 would be decorative.

**Fix.** Bind the target to the authenticated caller rather than the URL parameter, so a user may
only change their own password:

```js
const resultPassword = await UserPassword.findOneAndUpdate(
  { user: userProfile._id, removed: false },
  { $set: UserPasswordData },
  …
```

The `:id` route parameter remains in the URL for backwards compatibility with existing frontend
calls, but no longer selects the target. If `:id` does not match the caller, the request still
succeeds against the caller's own account — matching the route's actual purpose, which is the
"change my password" flow.

No Super Admin password-reset endpoint is added; that is not in the brief and would reintroduce a
legitimate-looking version of the same capability. If it is wanted later it should be its own
endpoint with its own audit trail.

**Regression risk: none.** A search of `frontend/src` for `password-update` and `passwordUpdate`
returns no callers — this route is unused by the UI. The frontend's "change my password" flow goes
to `PATCH /api/admin/profile/password`, handled by the separate
`createUserController/updateProfilePassword.js`, which *already* correctly targets
`userProfile._id` (line 43). This fix therefore does not change any behavior the frontend relies on;
it makes the unused handler match the one that is actually in service.

## 9. Bootstrap: creating the first Super Admin

**New files:** `controllers/coreControllers/bootstrapSuperAdmin.js`, routed from
`routes/coreRoutes/coreAuth.js` (the unauthenticated public router).

```
GET /api/bootstrap-superadmin?secret=$BOOTSTRAP_SECRET
```

| Condition | Response |
|---|---|
| `BOOTSTRAP_SECRET` unset in the environment | `503` — refuses to run unprotected |
| `secret` query param mismatch | `403` |
| Any existing Admin has `isSuperAdmin: true` | `409` — idempotent, no write |
| Otherwise | `200`, creates exactly one Admin + one AdminPassword |

**Credentials**

- Email: `superadmin@3pldynamicsai.com`
- Password: read from `SA_BOOTSTRAP_PASSWORD`, **never hardcoded**. If that variable is unset the
  route returns `503` and writes nothing, so no credential ever enters the repository or the
  transcript.

**Guarantees**

- Creates a brand new account. It does not look up, update or delete any existing Admin,
  AdminPassword or tenant document.
- Uses the same `uniqueId()` salt + `generateHash()` flow as §7.3.
- Sets `isSuperAdmin: true`, `isActive: true`, `enabled: true`, `role: 'owner'`.
- Creates **no** settings documents for this account.

### Removal checklist (required after successful bootstrap)

Identical in shape to the `migrate-ownership` removal in commit `d92dfe44`:

1. Delete `backend/src/controllers/coreControllers/bootstrapSuperAdmin.js`.
2. Remove its `require` and `router.route(...)` from `backend/src/routes/coreRoutes/coreAuth.js`.
3. Confirm a repo-wide grep for `bootstrapSuperAdmin` and `bootstrap-superadmin` returns nothing.
4. Remove `BOOTSTRAP_SECRET` and `SA_BOOTSTRAP_PASSWORD` from Vercel environment variables.
5. Redeploy.
6. Change the Super Admin password from its bootstrap value after first login.

## 10. Files touched

**New**

| Path | Purpose |
|---|---|
| `backend/src/utils/moduleList.js` | `MODULE_KEYS`, `resolveModules`, `isValidModuleKey` |
| `backend/src/middlewares/requireSuperAdmin.js` | Super Admin gate |
| `backend/src/routes/coreRoutes/superAdminApi.js` | Route group |
| `backend/src/controllers/coreControllers/superAdminController/index.js` | Controller barrel |
| `backend/src/controllers/coreControllers/superAdminController/listUsers.js` | §7.2 |
| `backend/src/controllers/coreControllers/superAdminController/createUser.js` | §7.3 |
| `backend/src/controllers/coreControllers/superAdminController/toggleUserStatus.js` | §7.4 |
| `backend/src/controllers/coreControllers/superAdminController/updateUserPermissions.js` | §7.5 |
| `backend/src/controllers/coreControllers/bootstrapSuperAdmin.js` | §9 — deleted after use |

**Modified**

| Path | Change |
|---|---|
| `backend/src/models/coreModels/Admin.js` | Three new fields (§4) |
| `backend/src/controllers/middlewaresControllers/createAuthMiddleware/login.js` | `isActive` guard, skip settings seed for super admin (§6.1) |
| `backend/src/controllers/middlewaresControllers/createAuthMiddleware/isValidAuthToken.js` | `isActive` guard (§6.2) |
| `backend/src/controllers/middlewaresControllers/createUserController/updatePassword.js` | Target bound to caller (§8) |
| `backend/src/controllers/middlewaresControllers/createAuthMiddleware/authUser.js` | Login response gains `isSuperAdmin` + resolved `modulePermissions` (§7.6) |
| `backend/src/app.js` | Mount `/api/superadmin` (§7.1) |
| `backend/src/routes/coreRoutes/coreAuth.js` | Bootstrap route (§9) — reverted after use |

## 11. Risks

| Risk | Mitigation |
|---|---|
| A future controller dumps an Admin document and leaks `loggedSessions` or a hash. | `listUsers` uses an explicit whitelist; the Super Admin routes are the only new Admin-collection read path. |
| The `enabled` / `isActive` overlap confuses operators — an account shows active in the new UI but cannot log in. | `createUser` sets both. `listUsers` returns both so a mismatch is visible. Consolidation is flagged as future work. |
| The bootstrap route is forgotten and stays deployed. | It is idempotent (409 once a Super Admin exists) and refuses to run without both env vars. §9 carries an explicit removal checklist. |
| Suspending a tenant does not immediately take effect. | The check is in `isValidAuthToken`, so it applies per request, not at token expiry. |
| A Super Admin's tenant-scoped dashboards are empty and this reads as a bug. | Expected and by design — decision D1. The Super Admin owns no business records. |
| Module revocation does not take effect until the tenant's next login (§7.6). | Documented as a deliberate non-goal. `isActive` suspension *is* immediate, via §6.2 — only module scoping is deferred. |

### Known issue, deliberately out of scope

`GET /api/admin/read/:id` (`routes/coreRoutes/coreApi.js:14`) has the same root cause as §8 — it
reads `req.params.id` without binding it to the caller, so any tenant can read another admin's
`name`, `email`, `role` and `enabled` by ID. Severity is **low**: the response is a four-field
whitelist with no credential material, so it is an enumeration leak, not a takeover.

It is not fixed here because §8 is the item that actually protects the Super Admin account, and
expanding this change to every `Admin`-collection route would widen the blast radius of an already
security-sensitive commit. It is recorded so it is a decision rather than an oversight.

## 12. Verification

The user has instructed that no automated tests be run for this change. Verification is therefore by
inspection and, after deploy, by the following manual sequence. Every step below is a *check*, not a
test suite.

**Static, before deploy**

1. `node --check` on every new and modified JavaScript file.
2. Repo-wide grep for `bootstrapSuperAdmin` / `bootstrap-superadmin` to confirm the removal
   checklist in §9 is complete.
3. Confirm `Admin.js` still declares `role` as `enum: ['owner']` with default `'owner'`.

**After deploy, before bootstrap removal**

4. `GET /api/bootstrap-superadmin` with no secret → `503`.
5. With a wrong secret → `403`.
6. With the correct secret → `200`, one account created.
7. Repeat step 6 → `409`, and confirm no second account was created.
8. Log in as each of the three legacy admins → succeeds, and `GET /api/invoice/list` for a legacy
   admin returns their previous records unchanged.
9. As a legacy admin, `GET /api/superadmin/users` → `403`.
10. As the Super Admin, `GET /api/superadmin/users` → lists all accounts, no password or salt fields
    present in the response.
11. As the Super Admin, `GET /api/invoice/list` → empty result, confirming D1 holds.
12. Suspend a demo tenant, then reuse that tenant's existing token → `403 "Account suspended"`.
13. As that tenant, attempt login → `403 "Account suspended"`.
14. Reactivate, confirm login works again.
15. As tenant A, `PATCH /api/admin/password-update/<tenant B id>` → succeeds but changes **A's own**
    password; confirm B can still log in with B's original password.
16. As the Super Admin, attempt to suspend own account → `409`.
17. Log in as a legacy admin → response body contains `isSuperAdmin: false` and a
    `modulePermissions` array listing every key in `MODULE_KEYS`.
18. Restrict a tenant to `['dashboard','invoice']`, have them log in → `modulePermissions` is exactly
    those two keys.

Then execute the §9 removal checklist.
