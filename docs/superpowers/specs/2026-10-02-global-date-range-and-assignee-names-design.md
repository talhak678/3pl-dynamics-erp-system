# Global Date Range Filter + Assignee Names in Show Views

Date: 2026-10-02
Status: approved, ready for implementation

## Intent

Two CEO-requested system-wide updates:

1. **Move the Dashboard date range filter into the main app header** so it is reachable from
   every module, and have the module tables honor the selected window.
2. **Stop the Show views printing a raw MongoDB ObjectId** for the "Assign To" field.

Both must leave data isolation intact (a child user sees only their own/assigned rows; an
owner sees the whole tenant) and must leave the Super Admin control plane untouched.

## Findings that shaped the design

These are evidence from the codebase, not assumptions, and two of them contradict the
original brief.

### The pickers and the tables are separable — the load-bearing fact

Form dropdowns call the request layer **directly**:

- `components/SelectAsync` → `request.list` (tax, payment-mode, category pickers)
- `components/AutoCompleteAsync` → `request.search` (client, lead pickers)
- `components/AssigneeSelect` → `request.team.list`
- `components/MultiStepSelectAsync` → `request.list` / `request.filter`

Data tables instead dispatch the Redux actions `crud.list` / `erp.list`, which call
`request.list` themselves. So a window merged into those two actions reaches every table and
no picker. This is what makes a global filter safe to add at all: a custom range that quietly
hid last month's clients would make the Invoice form unable to reference them.

### Most models have no business date

Only `Expense`, `Invoice`, `Offer`, `Payment`, `Quote`, `Shipment` declare a path named
`date`. `dateFieldFor()` falls back to `created` for every other model, and **no model uses
`timestamps: true`**, so `createdAt` does not exist anywhere. Filtering master data would
mean "rows created in this window", and a Daily preset would render Products, Taxes, Payment
Modes, Categories and Employees empty.

### The Show-view bug is narrower than the brief says

`Invoice`, `Quote`, `Offer` and `Payment` Show views (`modules/ErpPanelModule/ReadItem.jsx`)
render a bespoke PageHeader/Descriptions layout that never renders `assignedTo` or
`createdBy`. There is no raw id to fix there.

The real surface is the six CrudModule entities that declare an `assignedTo` field:
**Lead, Customer, Company, People, Expense, Expense Category** — all rendered by
`components/ReadItem/index.jsx`.

### A backend populate alone would make the bug worse

`ReadItem` renders `<p>{value}</p>`, and `dataForRead` pushes every field including ones
flagged `disableForTable`. Populating the backend turns the string into an object and the
panel would print `[object Object]`. The fix needs both halves.

### The Super Admin boundary is structural

`superadmin/` is a separate app with its own header and its own Redux store.
`routes/coreRoutes/superAdminApi.js` exposes only four user-management routes and serves **no
entity `read` or `list` at all**. `superAdminApi.js` does not use `createCRUDController`, and
`teamApi.js` uses `teamController`. So tenant-side changes to the generic CRUD controllers
cannot reach the control plane.

---

## Task 1 — Global date range

### Decisions

| Decision | Choice |
|---|---|
| Which modules filter | Dated records only: `lead`, `invoice`, `quote`, `offer`, `payment`, `expense` |
| Global state | Redux (already present); no new dependency, no `redux-persist` |
| Number of controls | One — in the header. The Dashboard's local control is removed |
| Persistence | In-memory; survives navigation, resets to Monthly on reload |
| Where the window attaches | The `crud.list` and `erp.list` Redux actions |

### State

New slice `frontend/src/redux/dateRange/` in the existing five-file shape
(`types.js`, `actions.js`, `reducer.js`, `selectors.js`, `index.js`), registered in
`redux/rootReducer.js`. State is `{ preset, custom: { from, to } }` — the shape the hook
already holds.

Selectors:

- `selectDateRangeQuery` → `{ startDate, endDate }` as ISO strings, or `{}`
- `selectDateRangeDescription` → e.g. `Last 30 days`
- `selectDateRangePreset` / `selectDateRangeCustom` for the dialog's draft sync

### Reuse rather than rewrite

`modules/DashboardModule/dateRange.js` is pure and already covered by a 41-check harness, so
it moves to `frontend/src/utils/dateRange.js` with **no logic change**. Both the header and
the dashboard import it.

`modules/DashboardModule/useDateRange.js` keeps its **exact current interface**
(`{ preset, custom, range, query, description, apply, reset }`) but reads and writes the
store instead of `useState`. Consequences:

- `components/DateRangeFilter.jsx` needs no change at all.
- The Dashboard keeps working unchanged, because it consumes the same hook.
- Only the Dashboard's *rendering* of the control is removed, so one state has one control.

The existing memoization discipline carries over: `query` must keep a stable identity or the
Dashboard's fetch effect will loop.

### Header

`DateRangeFilter` is mounted in `apps/Header/HeaderContainer.jsx`, beside `ThemeToggleButton`.
Tenant-only by construction — `superadmin/` has a different `HeaderContainer` and a different
store, so nothing is shared.

### Applying the window

In `redux/crud/actions.js` and `redux/erp/actions.js`, the `list` thunk reads the window from
`getState()` and merges it into `options`. This also covers the post-write re-fetches
(`CreateForm`, `UpdateForm`, `DeleteModal`, `CrudModal`, `ErpPanelModule/DeleteItem`,
`RecordPayment`, `UpdatePayment`), which dispatch the same actions — without that, a
just-created record would disappear from its own table.

**Policy lives on the backend, not the frontend.** The frontend sends the window on table
list calls without deciding which entities honor it. Each backend list controller opts in.
This avoids a second hand-maintained mirror of module policy — the same class of artifact as
the `moduleList` mirrors that already drift.

### Backend

`withDateWindow(Model, req, ...conditions)` in `backend/src/utils/dateRange.js` already exists
and is unchanged. It returns `{ $and: [{ removed: false }, ...conditions, dateMatch?] }`, so
the window is always its own clause.

Added to the `paginatedList` of the six dated entities. The table endpoints use
`paginatedList` (via `controller.list`), **not** `listAll` — the earlier dashboard work wired
`listAll` only, so this is new ground:

| Entity | Change |
|---|---|
| `lead` | add window to existing `leadController/paginatedList.js` |
| `invoice` | add window to existing `invoiceController/paginatedList.js` |
| `quote` | add window to existing `quoteController/paginatedList.js` |
| `offer` | add window to existing `offerController/paginatedList.js` |
| `payment` | **new** `paymentController/paginatedList.js`, wired into its existing `index.js` |
| `expense` | **new** `expenseController/` folder (`index.js` + `paginatedList.js`) |

`expenseController/index.js` follows the existing `leadController/index.js` pattern exactly:
build from `createCRUDController('Expense')`, override `list`, inherit the rest.

**No shared filter file is edited.** The generic
`controllers/middlewaresControllers/createCRUDController/paginatedList.js` is deliberately
left alone: editing it would also window the undated entities that share it (Product, Taxes,
Payment Mode, Settings).

### Isolation

Unchanged, and not re-derived: the window is appended as a separate `$and` entry beside the
existing `scopedFilter` clause, so MongoDB intersects them and it can only narrow. The
existing 58-check backend harness proves this shape; it will be extended across each newly
windowed controller, including the child-user case (tenant clause and assignment `$or` both
intact beside the window).

---

## Task 2 — Assignee names in Show views

### Backend

Populate `assignedTo` with `'name'` on the read paths:

- `leadController/read.js` — add `.populate('assignedTo', 'name')`, and `migrate()` must pass
  the populated value through instead of the bare id. The comment already in `migrate.js`
  anticipated exactly this. `assignedTo` refs `Admin`.
- `Customer (Client)`, `Company`, `Expense`, `Expense Category` — served by the generic
  `createCRUDController/read.js`, which populates nothing today.

The generic read gains a **schema-guarded** populate: it resolves only paths that exist on
that model with a `ref`. The guard is the safety mechanism — Mongoose `strictPopulate` throws
when asked to populate a path not in the schema, which would break Product, Taxes, Payment
Mode and Setting.

This is the one shared file edited rather than duplicated. Justification: it changes no
*policy*. It resolves an id that was already being returned, so it cannot widen a filter or
re-scope data — a different class of change from the filter-widening the standing Super Admin
rule guards against. And the router it serves is unreachable from the control plane.

### Frontend

- `utils/dataStructure.jsx` — `dataForRead` gains `isAssignee: field.type === 'assignee'`,
  following the `isDate` pattern already there.
- `components/ReadItem/index.jsx` — renders `value?.name ?? value` for assignee columns.

The `?? value` fallback is required: if a value ever arrives unpopulated it renders the id
rather than `[object Object]`, so the change is backward-compatible with any read path not
covered above.

### Regression guard

The Lead **`listAll` is not changed**, so `usePipelineAnalytics.js` (`String(lead.assignedTo)`)
and the pipeline board's `resolveAssignee()` keep receiving bare ids. Only `read` changes.

Note also that client-side resolution could not have fixed this: `useAssigneeDirectory` reads
`/api/team`, which sits behind `requireTenantOwner`, so it cannot name an assignee for a Sales
Executive. The server-side populate is the only fix that works for a child user.

---

## Out of scope, deliberately

- **Shipment** — the model declares a `date` and is in the dated set, but there is no frontend
  page for it, so there is no table to filter.
- **Master data and party lists** — Products, Taxes, Payment Modes, Categories, Employees,
  Customers, Company, People stay unfiltered. Their "date" would be record-creation date.
- **`createdBy` / `createdByUser` display** — no frontend file renders either field, so there
  is nothing to fix.
- **The Sales Pipeline kanban and User Management** — they fetch directly rather than through
  the table actions, so they stay unfiltered.
- **`superadmin/`** — untouched, as always.

## Verification

Static only; no dev server, no test suite (the user deploys and browser-tests on Vercel).

1. `node superadmin/scripts/check-syntax.cjs frontend` and `... backend`
2. `npm run build` in `frontend`
3. Throwaway Node harnesses in the system temp dir (never in the repo):
   - extend the backend date-range harness across each newly windowed controller, asserting
     the child-user scope survives beside the window
   - exercise the guarded populate against real schemas: a model with `assignedTo` resolves,
     a model without it does not throw
   - assert the frontend query shape round-trips into `dateMatchFor`
4. Re-count the route inventory against the known baseline: lead 9, team 5, superadmin 4,
   189 handlers total — proving no route was added, removed or re-scoped.
