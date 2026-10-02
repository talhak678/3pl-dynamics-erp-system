# Global Date Range Filter + Assignee Names — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Dashboard's date range filter into the main app header as global state, apply
the window to the six dated module tables, and make the six CrudModule Show views render an
assignee's name instead of a raw ObjectId.

**Architecture:** A new `dateRange` Redux slice holds the chosen window; a header control edits
it and `useDateRange` keeps its existing interface so the Dashboard needs no rewiring. The window
is merged into `options` inside the `crud.list` / `erp.list` thunks — the one place every table
fetch passes through and no form picker does. On the server, a new gated helper decides which
models honor a window, so the policy lives in one named function rather than per-controller
copies.

**Tech Stack:** React 18, Redux Toolkit + reselect, antd 5, dayjs (frontend); Express, Mongoose 7
(backend).

**Spec:** `docs/superpowers/specs/2026-10-02-global-date-range-and-assignee-names-design.md`

## Global Constraints

- **No dev server, no test suites.** Do not run `npm start`, `npm run dev`, or any test runner.
  The user deploys to Vercel and browser-tests there. Verification is: `check-syntax.cjs`,
  `npm run build`, and throwaway Node harnesses run from the system temp dir.
- **Never write a harness into the repo.** All harness files live in
  `C:/Users/System Angel/AppData/Local/Temp/`. A harness in the repo is a plan failure.
- **Super Admin must stay untouched.** `superadmin/` is a separate app with its own store and
  header. No file under `superadmin/` is modified by this plan. The Super Admin route inventory
  (4 handlers) must be identical at the end.
- **Prefer a new tenant-only function over editing a shared one.** The one shared backend file
  edited (`createCRUDController/paginatedList.js`) gets a call to a new function, not new policy.
- **Frontend `translate()` is not i18n.** `getLabel` only replaces `_` with spaces and
  upper-cases each word's first letter; `en_us.js` keys are never read. Use plain strings.
- **Commits are held.** The repo is on `main` and the user has not asked for commits. Each task
  lists the commit it would make; run them only on the user's go-ahead, and branch first.
- **Do not touch:** the deferred `report` module cleanup, the three `moduleList` mirrors, or
  `frontend/src/modules/DashboardModule/components/SalesAnalytics/` beyond what a task names.

## Review Focus

Input classes the spec implies but no task's code obviously guards. Each gets its test in the
task noted.

1. **A custom range with only one end filled** (From set, To empty, or vice versa) — a user would
   expect "everything from that date on". A filter that silently requires both, or that throws,
   would break the page. → Task 6, Step 2, check 7.
2. **An unassigned record** (`assignedTo` is null or absent) — a user would expect a blank, not
   the string `null` or `undefined`. → Task 8, Step 5, check 5; Task 9, Step 5, check 4.
3. **An assignee whose account was deleted** (populate resolves to null) — a user would expect
   the row to still render, showing blank rather than crashing the panel. → Task 8, Step 5,
   check 6; Task 9, Step 5, check 5.
4. **A garbage date in the query string** (`?startDate=not-a-date`) — a user who edits the URL or
   hits a stale bookmark would expect the filter to be ignored, not a 500. → Task 6, Step 2,
   check 6.
5. **From later than To** — a user would expect no results, never the whole table (which is what
   an inverted range silently becomes if it is not handled). → Task 6, Step 2, check 8.

---

## File Structure

**Backend**

| File | Responsibility |
|---|---|
| `backend/src/utils/dateRange.js` | *Modify.* Add `DATED_MODELS` + `datedWindowFor`. Existing exports unchanged. |
| `backend/src/controllers/middlewaresControllers/createCRUDController/paginatedList.js` | *Modify.* One gated window call. Serves payment, expense and every undated entity. |
| `backend/src/controllers/appControllers/leadController/paginatedList.js` | *Modify.* Same gated call. |
| `backend/src/controllers/appControllers/invoiceController/paginatedList.js` | *Modify.* Same. |
| `backend/src/controllers/appControllers/quoteController/paginatedList.js` | *Modify.* Same. |
| `backend/src/controllers/appControllers/offerController/paginatedList.js` | *Modify.* Same. |
| `backend/src/controllers/middlewaresControllers/createCRUDController/read.js` | *Modify.* Schema-guarded populate. |
| `backend/src/controllers/appControllers/leadController/read.js` | *Modify.* Populate `assignedTo`. |
| `backend/src/controllers/appControllers/leadController/migrate.js` | *Modify.* Normalise the assignee field. |

**Frontend**

| File | Responsibility |
|---|---|
| `frontend/src/utils/dateRange.js` | *Move* from `modules/DashboardModule/dateRange.js`, verbatim. Pure window maths. |
| `frontend/src/redux/dateRange/{types,actions,reducer,selectors,index}.js` | *Create.* Holds the chosen window; derives query + description. |
| `frontend/src/redux/rootReducer.js` | *Modify.* Register the slice. |
| `frontend/src/modules/DashboardModule/useDateRange.js` | *Rewrite.* Store-backed, same return shape. |
| `frontend/src/apps/Header/HeaderContainer.jsx` | *Modify.* Mount the control. |
| `frontend/src/modules/DashboardModule/index.jsx` | *Modify.* Remove the local control. |
| `frontend/src/redux/crud/actions.js` | *Modify.* Merge the window in `list`. |
| `frontend/src/redux/erp/actions.js` | *Modify.* Merge the window in `list`. |
| `frontend/src/utils/helpers.js` | *Modify.* Add `assigneeLabel`. |
| `frontend/src/utils/dataStructure.jsx` | *Modify.* Mark assignee columns in `dataForRead`. |
| `frontend/src/components/ReadItem/index.jsx` | *Modify.* Render the label. |

---

### Task 1: Move the date range helpers somewhere both the header and the Dashboard can reach

`dateRange.js` is pure and already covered by a 41-check harness. It moves, unchanged, out of
`DashboardModule` so the header does not have to import from a module folder.

**Files:**
- Move: `frontend/src/modules/DashboardModule/dateRange.js` → `frontend/src/utils/dateRange.js`
- Modify: `frontend/src/modules/DashboardModule/useDateRange.js:3-8`
- Modify: `frontend/src/modules/DashboardModule/components/DateRangeFilter.jsx` (its import line)

**Interfaces:**
- Consumes: nothing.
- Produces: `@/utils/dateRange` exporting `DATE_RANGE_PRESETS`, `DEFAULT_DATE_RANGE_PRESET`,
  `PRESET_LABELS`, `PRESET_DESCRIPTIONS`, `rangeForPreset(preset, custom, now?)`,
  `rangeToQuery(range)`, `isCustomRangeValid(custom)`, `describeRange(preset, custom)`.

- [ ] **Step 1: Move the file with git so the history follows it**

```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
git mv frontend/src/modules/DashboardModule/dateRange.js frontend/src/utils/dateRange.js
```

- [ ] **Step 2: Find every importer of the old path**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm/frontend/src"
grep -rn "from './dateRange'\|from '../dateRange'\|DashboardModule/dateRange" --include=*.js --include=*.jsx .
```
Expected: `modules/DashboardModule/useDateRange.js` and
`modules/DashboardModule/components/DateRangeFilter.jsx`. If any other file appears, update it
too — the build in Step 4 is the backstop.

- [ ] **Step 3: Update the import specifiers**

In `useDateRange.js`, replace the relative import with the alias:
```js
import {
  DEFAULT_DATE_RANGE_PRESET,
  describeRange,
  rangeForPreset,
  rangeToQuery,
} from '@/utils/dateRange';
```

In `DateRangeFilter.jsx`, replace its `'../dateRange'` (or `'../../dateRange'`) specifier with
`'@/utils/dateRange'`, leaving the named imports exactly as they are.

- [ ] **Step 4: Prove nothing else referenced the old location**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs frontend
cd frontend && npm run build
```
Expected: `Syntax check passed — no parse errors.` and `✓ built in …`. A stale import path fails
the build, which is exactly the signal wanted here.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/utils/dateRange.js frontend/src/modules/DashboardModule
git commit -m "refactor: move date range helpers to utils so the header can share them"
```

---

### Task 2: The `dateRange` Redux slice

Holds `{ preset, custom }` and derives the query and the label from the pure helpers, so there is
one place that knows what window is selected.

**Files:**
- Create: `frontend/src/redux/dateRange/types.js`
- Create: `frontend/src/redux/dateRange/reducer.js`
- Create: `frontend/src/redux/dateRange/actions.js`
- Create: `frontend/src/redux/dateRange/selectors.js`
- Create: `frontend/src/redux/dateRange/index.js`
- Modify: `frontend/src/redux/rootReducer.js`

**Interfaces:**
- Consumes: `@/utils/dateRange` from Task 1.
- Produces: `dateRange.apply({ preset, custom })`, `dateRange.reset()`, and the selectors
  `selectDateRangePreset`, `selectDateRangeCustom`, `selectDateRangeQuery` (→ `{startDate,endDate}`
  or `{}`), `selectDateRangeDescription`, `selectDateRangeRange`.

- [ ] **Step 1: Write the action types**

`frontend/src/redux/dateRange/types.js`:
```js
export const DATE_RANGE_APPLY = 'DATE_RANGE_APPLY';
export const DATE_RANGE_RESET = 'DATE_RANGE_RESET';
```

- [ ] **Step 2: Write the reducer**

`frontend/src/redux/dateRange/reducer.js`:
```js
import * as actionTypes from './types';
import { DEFAULT_DATE_RANGE_PRESET } from '@/utils/dateRange';

/*
 * A shared constant rather than a fresh literal, because the reducer returns it
 * and the derived selectors memoise on the object's identity. A new `{from:null,
 * to:null}` on every reset would be a new input, and the window would be
 * recomputed - and re-fetched - for a value that did not change.
 */
const NO_CUSTOM_RANGE = { from: null, to: null };

const INITIAL_STATE = {
  preset: DEFAULT_DATE_RANGE_PRESET,
  custom: NO_CUSTOM_RANGE,
};

const dateRangeReducer = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case actionTypes.DATE_RANGE_APPLY:
      return {
        preset: action.payload.preset,
        // Applied together so the store can never briefly describe a Custom
        // window with no dates in it.
        custom: action.payload.custom || NO_CUSTOM_RANGE,
      };
    case actionTypes.DATE_RANGE_RESET:
      return INITIAL_STATE;
    default:
      return state;
  }
};

export default dateRangeReducer;
```

- [ ] **Step 3: Write the actions**

`frontend/src/redux/dateRange/actions.js`:
```js
import * as actionTypes from './types';

export const dateRange = {
  apply:
    ({ preset, custom }) =>
    async (dispatch) => {
      dispatch({
        type: actionTypes.DATE_RANGE_APPLY,
        payload: { preset, custom },
      });
    },
  reset:
    () =>
    async (dispatch) => {
      dispatch({
        type: actionTypes.DATE_RANGE_RESET,
      });
    },
};
```

- [ ] **Step 4: Write the selectors**

`frontend/src/redux/dateRange/selectors.js`:
```js
import { createSelector } from 'reselect';

import { describeRange, rangeForPreset, rangeToQuery } from '@/utils/dateRange';

const selectDateRange = (state) => state.dateRange;

export const selectDateRangePreset = createSelector([selectDateRange], (dateRange) => dateRange.preset);

export const selectDateRangeCustom = createSelector([selectDateRange], (dateRange) => dateRange.custom);

/*
 * Memoised on the two primitives, and this is load-bearing rather than an
 * optimisation - the same trap useDateRange documented when it held this in
 * useState.
 *
 * `rangeForPreset` builds dayjs objects from the current time, so recomputing
 * on every call would hand the dashboard's fetch effect brand new start and end
 * instants each time: a new effect input on every render, and therefore a fetch
 * on every render, forever. reselect is what makes the identity stable, and it
 * works here only because `custom` is the same object reference between applies
 * (see the reducer) and `preset` is a string.
 *
 * The cached consequence is deliberate: "today" is fixed at the moment the
 * window was chosen, so a dashboard left open overnight does not silently
 * redefine what its own button still calls "Last 30 days".
 */
const selectRange = createSelector([selectDateRangePreset, selectDateRangeCustom], (preset, custom) =>
  rangeForPreset(preset, custom)
);

export const selectDateRangeRange = selectRange;

export const selectDateRangeQuery = createSelector([selectRange], (range) => rangeToQuery(range));

export const selectDateRangeDescription = createSelector(
  [selectDateRangePreset, selectDateRangeCustom],
  (preset, custom) => describeRange(preset, custom)
);
```

- [ ] **Step 5: Write the slice barrel**

`frontend/src/redux/dateRange/index.js`:
```js
export { default as reducer } from './reducer';
```

- [ ] **Step 6: Register the slice**

In `frontend/src/redux/rootReducer.js`, add the import beside the others and the key in the
`combineReducers` call:
```js
import { reducer as dateRangeReducer } from './dateRange';
```
```js
const rootReducer = combineReducers({
  auth: authReducer,
  crud: crudReducer,
  erp: erpReducer,
  adavancedCrud: adavancedCrudReducer,
  settings: settingsReducer,
  dateRange: dateRangeReducer,
});
```

- [ ] **Step 7: Check syntax and build**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs frontend
cd frontend && npm run build
```
Expected: `Syntax check passed — no parse errors.` then `✓ built in …`.

- [ ] **Step 8: Harness the selectors against the pure helpers**

Create `C:/Users/System Angel/AppData/Local/Temp/daterange-slice-harness.cjs`. It bundles the real
selectors with esbuild (the same technique as `daterange-frontend-harness.cjs`), builds a store
with the real reducer, and asserts:

1. The initial state's `query` is the monthly window — not empty, because the default is a real
   30-day window rather than "all time".
2. `apply({preset:'daily'})` changes `query.startDate` and **changes its object identity**.
3. Re-selecting the same preset and re-dispatching with the **same `custom` object reference**
   leaves `selectDateRangeQuery` returning the **identical object** (this is the anti-loop
   property; assert with `===`).
4. `reset()` returns `preset` to `DEFAULT_DATE_RANGE_PRESET` and `query` back to the monthly
   window.
5. `description` for a custom range equals `` `${from} - ${to}` `` in the configured date format.

Run: `node "C:/Users/System Angel/AppData/Local/Temp/daterange-slice-harness.cjs"`
Expected: all checks pass. If check 3 fails, the memoisation is broken and the dashboard will
fetch in a loop — fix the selector chain before continuing (most likely cause: a selector
returning a fresh object instead of a primitive).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/redux/dateRange frontend/src/redux/rootReducer.js
git commit -m "feat: add global dateRange redux slice"
```

---

### Task 3: Make `useDateRange` store-backed, keeping its interface

The hook's consumers must not change. `DateRangeFilter.jsx` is not touched at all — it takes
props and has no idea where they come from.

**Files:**
- Modify: `frontend/src/modules/DashboardModule/useDateRange.js` (full rewrite)

**Interfaces:**
- Consumes: the slice from Task 2.
- Produces: default export `useDateRange()` → `{ preset, custom, range, query, description, apply,
  reset }`, identical to before.

- [ ] **Step 1: Confirm no caller reads `range`**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm/frontend/src"
grep -rn "useDateRange" --include=*.jsx --include=*.js .
```
Expected: `useDateRange.js` itself, `modules/DashboardModule/index.jsx`, and
`components/DateRangeFilter.jsx` (which does *not* call the hook — verify). `range` stays in the
return shape for parity regardless.

- [ ] **Step 2: Rewrite the hook**

`frontend/src/modules/DashboardModule/useDateRange.js`:
```js
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { dateRange } from '@/redux/dateRange/actions';
import {
  selectDateRangeCustom,
  selectDateRangeDescription,
  selectDateRangePreset,
  selectDateRangeQuery,
  selectDateRangeRange,
} from '@/redux/dateRange/selectors';

/**
 * The chosen window, read from the global store.
 *
 * This used to hold the selection in useState, when the only screen that cared
 * was the dashboard. The window is now set from the app header and read by every
 * module's table, so it has to outlive any one screen and be the same value
 * everywhere - two copies would let the button and the cards disagree about
 * which period is on screen.
 *
 * The return shape is deliberately unchanged, so DateRangeFilter needs no edit
 * and the dashboard keeps working: only the storage moved.
 *
 * The identity guarantee that used to come from useMemo now comes from the
 * selectors - see the note there, and do not unwrap them into plain functions,
 * because the dashboard's fetch effect depends on that identity to avoid
 * re-fetching on every render.
 */
export default function useDateRange() {
  const dispatch = useDispatch();

  const preset = useSelector(selectDateRangePreset);
  const custom = useSelector(selectDateRangeCustom);
  const range = useSelector(selectDateRangeRange);
  const query = useSelector(selectDateRangeQuery);
  const description = useSelector(selectDateRangeDescription);

  const apply = useCallback(
    (nextPreset, nextCustom) => {
      dispatch(
        dateRange.apply({ preset: nextPreset, custom: nextCustom || { from: null, to: null } })
      );
    },
    [dispatch]
  );

  const reset = useCallback(() => {
    dispatch(dateRange.reset());
  }, [dispatch]);

  return { preset, custom, range, query, description, apply, reset };
}
```

- [ ] **Step 3: Check syntax and build**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs frontend
cd frontend && npm run build
```
Expected: syntax passes, build succeeds. The Dashboard still renders its own control at this
point — that is fine and expected until Task 4.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/DashboardModule/useDateRange.js
git commit -m "refactor: back useDateRange with the global store, same interface"
```

---

### Task 4: Put the control in the app header and take it out of the Dashboard

**Files:**
- Modify: `frontend/src/apps/Header/HeaderContainer.jsx`
- Modify: `frontend/src/modules/DashboardModule/index.jsx` (the header row, ~lines 474-494, and its destructure ~line 113)

**Interfaces:**
- Consumes: `useDateRange` (Task 3) and `@/modules/DashboardModule/components/DateRangeFilter`.
- Produces: nothing importable; a visible global control.

- [ ] **Step 1: Mount the control in the header**

In `HeaderContainer.jsx`, add the imports:
```js
import DateRangeFilter from '@/modules/DashboardModule/components/DateRangeFilter';
import useDateRange from '@/modules/DashboardModule/useDateRange';
```
and destructure inside the component, beside the existing `useLanguage()` call:
```js
const { preset, custom, description, apply, reset } = useDateRange();
```

Then replace the trailing part of the returned tree:
```jsx
      <ThemeToggleButton />
      {/* <UpgradeButton /> */}

      {/*
        The window every module's table is read over, here rather than on the
        dashboard because it now governs more than the dashboard.

        Rendered last in the JSX, which the Header's `flexDirection: row-reverse`
        turns into leftmost on screen - so it sits away from the avatar and the
        theme toggle, which are account controls, and reads as a page control
        rather than a third one of those.
      */}
      <DateRangeFilter
        preset={preset}
        custom={custom}
        description={description}
        onApply={apply}
        onReset={reset}
      />
    </Header>
```

- [ ] **Step 2: Remove the dashboard's own copy**

In `modules/DashboardModule/index.jsx`, find the header row that renders `<DateRangeFilter …/>`
inside a `<Col>` (the row also holds the Download Report `Button`). Delete the `DateRangeFilter`
`Col` and collapse the row, leaving:
```jsx
        {/*
          The range control moved to the app header, where it governs every
          module rather than this page alone. This row keeps the report, which is
          this page's own output and still summarised over whatever window the
          header is showing.
        */}
        <Row justify="end" style={{ marginBottom: 20 }}>
          <Col>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              loading={reportLoading}
              onClick={handleDownloadReport}
            >
              {translate('Download Report')}
            </Button>
          </Col>
        </Row>
```

- [ ] **Step 3: Trim the now-unused destructure**

The page no longer needs `preset`, `custom`, `apply` or `reset` — only the window itself. Change
the destructure to:
```js
  const { query: dateQuery, description: dateDescription } = useDateRange();
```
Then confirm the `DateRangeFilter` import is removed if nothing else in the file uses it:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm/frontend/src"
grep -n "DateRangeFilter\|preset\|custom\|apply\|reset" modules/DashboardModule/index.jsx
```
Expected: no remaining reference to `DateRangeFilter`; `dateQuery` and `dateDescription` still
used by the cards, `SalesAnalytics` and `CustomerPreviewCard`. Leave those alone.

- [ ] **Step 4: Check syntax and build**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs frontend
cd frontend && npm run build
```
Expected: syntax passes, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/apps/Header/HeaderContainer.jsx frontend/src/modules/DashboardModule/index.jsx
git commit -m "feat: move the date range control into the app header"
```

---

### Task 5: Merge the window into every table fetch

**Files:**
- Modify: `frontend/src/redux/crud/actions.js:38-47`
- Modify: `frontend/src/redux/erp/actions.js:36-45`

**Interfaces:**
- Consumes: `selectDateRangeQuery` (Task 2).
- Produces: nothing importable; every `crud.list` / `erp.list` dispatch now carries the window.

- [ ] **Step 1: Wire `crud.list`**

In `frontend/src/redux/crud/actions.js`, add the import:
```js
import { selectDateRangeQuery } from '@/redux/dateRange/selectors';
```
and replace the `list` thunk with:
```js
  list:
    ({ entity, options = { page: 1, items: 10 } }) =>
    async (dispatch, getState) => {
      dispatch({
        type: actionTypes.REQUEST_LOADING,
        keyState: 'list',
        payload: null,
      });

      /*
       * The header's window, read here rather than passed in by each caller.
       *
       * This thunk is the one path every table fetch takes - the initial load,
       * the pagination and search changes, and the re-fetch after a create,
       * update or delete - so reading it here means a row that was just saved
       * is still in the window its table is showing, instead of vanishing
       * because the re-fetch quietly asked a different question.
       *
       * Form pickers do not come through here; SelectAsync and
       * AutoCompleteAsync call the request layer directly. That is the property
       * that keeps this from hiding the clients and leads a form needs to
       * reference.
       *
       * Empty when no window is set, which leaves `options` untouched. Which
       * entities honour it is the server's decision, not this one's - see
       * datedWindowFor in backend/src/utils/dateRange.js.
       */
      const dateQuery = selectDateRangeQuery(getState());

      let data = await request.list({ entity, options: { ...options, ...dateQuery } });
```
Leave the rest of the thunk exactly as it is.

- [ ] **Step 2: Wire `erp.list`**

In `frontend/src/redux/erp/actions.js`, add the same import and change the thunk signature from
`async (dispatch) =>` to `async (dispatch, getState) =>`, inserting the same `dateQuery` line and
changing the call to `request.list({ entity, options: { ...options, ...dateQuery } })`. The
comment above applies verbatim; repeat it rather than referring to the other file.

- [ ] **Step 3: Check syntax and build**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs frontend
cd frontend && npm run build
```
Expected: syntax passes, build succeeds.

- [ ] **Step 4: Harness the merge, including the picker path**

Create `C:/Users/System Angel/AppData/Local/Temp/table-window-harness.cjs`. Bundle the real
`crud.list` and `erp.list` with esbuild, stubbing `@/request` so `request.list` records the
options it was handed and returns `{success:false}` (so the thunk takes its failure branch and
needs no pagination payload). Drive each thunk with a fake `dispatch` and a fake `getState`
returning `{dateRange:{preset:'custom', custom:{from, to}}}`. Assert:

1. With a Custom window set, `crud.list({entity:'expense', options:{page:1,items:10}})` reaches
   `request.list` with `startDate` and `endDate` present, and still with `page` and `items`.
2. With the default Monthly preset, the same call carries a `startDate` too — the default is a
   real window, not "all time".
3. The options object the **caller** passed is not mutated (assert the caller's object still has
   exactly `page` and `items`). A mutated shared default would leak the window into every later
   call.
4. `erp.list({entity:'invoice'})` behaves the same way, and works with **no `options` argument at
   all** — the default parameter must not swallow the window.

Run: `node "C:/Users/System Angel/AppData/Local/Temp/table-window-harness.cjs"`
Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/redux/crud/actions.js frontend/src/redux/erp/actions.js
git commit -m "feat: apply the global date window to every table fetch"
```

---

### Task 6: Teach the server which models a window applies to

The policy lives in one new function so no controller carries its own copy, and so the shared
generic list can call it without gaining policy of its own.

**Files:**
- Modify: `backend/src/utils/dateRange.js`

**Interfaces:**
- Consumes: `dateMatchFor(Model, req)` (already in the file).
- Produces: `DATED_MODELS` (a `Set` of model names) and `datedWindowFor(Model, req)` → a
  Mongo filter fragment or `null`.

- [ ] **Step 1: Add the gate**

Append to `backend/src/utils/dateRange.js`, and add both names to the `module.exports`:
```js
/*
 * The models a date window is meaningful for.
 *
 * Named rather than derived, because the derivation available is a lie here:
 * dateFieldFor() falls back to `created` for any model without a business date,
 * which would make a "Today" filter return the products, taxes, payment modes
 * and categories *created* today and nothing else. Every one of those screens
 * would look empty, and the report would be that the date filter broke the
 * catalogue.
 *
 * So the window is opt-in per model, and this set is the whole of the policy.
 * Shipment is in it because it declares a business date, though no screen lists
 * one yet.
 */
const DATED_MODELS = new Set([
  'Expense',
  'Invoice',
  'Lead',
  'Offer',
  'Payment',
  'Quote',
  'Shipment',
]);

/**
 * The date clause for this model, or null when the model is not one a window
 * applies to.
 *
 * Returning null rather than an empty object matters: every caller pushes the
 * result onto an `$and` only when it is truthy, so `{}` would add a clause that
 * matches everything and quietly turn a filtered list into an unfiltered one on
 * any model it reached.
 *
 * Takes the same req the ownership filters take, so the window is built from the
 * same query string and sits beside them as its own `$and` entry - which is what
 * makes it narrowing-only. See withDateWindow.
 */
const datedWindowFor = (Model, req) => {
  if (!Model || !DATED_MODELS.has(Model.modelName)) {
    return null;
  }

  return dateMatchFor(Model, req);
};
```
Change the export line to:
```js
module.exports = { dateMatchFor, withDateWindow, dateFieldFor, datedWindowFor, DATED_MODELS };
```

- [ ] **Step 2: Prove the gate before it is used by anything**

Create `C:/Users/System Angel/AppData/Local/Temp/dated-window-harness.cjs`, loading the real
schemas via `backend/src/models/index.js` (note: `require('mongoose')` takes ~13s here — allow a
300s timeout). Assert:

1. `datedWindowFor(Invoice, {query:{startDate,endDate}})` returns `{date:{$gte,$lte}}`.
2. `datedWindowFor(Product, {query:{startDate,endDate}})` returns **`null`** — not `{}`, not a
   `created` clause.
3. `datedWindowFor(Setting, …)` returns `null`.
4. `datedWindowFor(Lead, {query:{startDate,endDate}})` returns a clause on **`created`**, not
   `date`, because Lead has no business date (assert the key name explicitly).
5. With no dates in the query, every dated model returns `null`.
6. A garbage date (`{startDate:'not-a-date'}`) returns `null` rather than a clause that matches
   nothing.
7. **One-sided:** `{startDate: X}` only, and `{endDate: Y}` only, each return a clause with
   exactly one bound — never a clause requiring both, and never `null`. *(Review Focus 1.)*
8. **Inverted:** `{startDate: <later>, endDate: <earlier>}` returns a clause whose bounds are the
   ones given — a `$gte` above the `$lte`. Assert the two bound values specifically, because the
   dangerous outcome is not this clause but a helper that "helpfully" swaps the dates, drops the
   clause, or returns `null` for one: any of those turns an empty result into the whole table.
   *(Review Focus 5.)*

Run: `node "C:/Users/System Angel/AppData/Local/Temp/dated-window-harness.cjs"`
Expected: all checks pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/utils/dateRange.js
git commit -m "feat: add a gated, opt-in date window helper for dated models"
```

---

### Task 7: Apply the window in the table list controllers

Five files. Each gets the same three lines, placed after the existing conditions are built and
before the query is assembled.

**Files:**
- Modify: `backend/src/controllers/middlewaresControllers/createCRUDController/paginatedList.js:48-58`
- Modify: `backend/src/controllers/appControllers/leadController/paginatedList.js:28-44`
- Modify: `backend/src/controllers/appControllers/invoiceController/paginatedList.js:34-43`
- Modify: `backend/src/controllers/appControllers/quoteController/paginatedList.js` (same shape)
- Modify: `backend/src/controllers/appControllers/offerController/paginatedList.js` (same shape)

**Interfaces:**
- Consumes: `datedWindowFor` (Task 6).
- Produces: nothing importable.

- [ ] **Step 1: Add the window to the generic list**

In `createCRUDController/paginatedList.js`, add to the require line at the top:
```js
const { datedWindowFor } = require('../../../utils/dateRange');
```
and, immediately before `const query = { $and: conditions };`, insert:
```js
  /*
   * The header's date window, for the models it applies to and no others.
   *
   * Pushed as its own `$and` entry beside the scope rather than merged into it,
   * so it can only ever remove rows - an account's isolation is decided by
   * scopedFilter above and is unaffected by which window is selected.
   *
   * The gate lives in datedWindowFor, not here: this file is shared by every
   * entity with no list of its own, including models a window means nothing for.
   */
  const dateWindow = datedWindowFor(Model, req);

  if (dateWindow) conditions.push(dateWindow);
```

- [ ] **Step 2: Add the same block to the four custom lists**

`leadController/paginatedList.js` — add to the top, beside its existing
`require('../../../middlewares/ownership')` (same relative depth, so the specifier is identical):
```js
const { datedWindowFor } = require('../../../utils/dateRange');
```
and insert this block immediately before its `const query = { $and: conditions };` (line 44):
```js
  /*
   * The header's date window, for the models it applies to and no others.
   *
   * Pushed as its own `$and` entry beside leadFilter's scope rather than merged
   * into it, so it can only ever remove rows - which leads a child user sees is
   * decided above and is unaffected by which window is selected.
   *
   * The gate lives in datedWindowFor, not here: it is what keeps this list from
   * gaining a `created` window that leadFilter never asked for.
   */
  const dateWindow = datedWindowFor(Model, req);

  if (dateWindow) conditions.push(dateWindow);
```

Then do the same to each of `invoiceController/paginatedList.js`,
`quoteController/paginatedList.js` and `offerController/paginatedList.js`:

1. Add `const { datedWindowFor } = require('../../../utils/dateRange');` to the require block at
   the top.
2. Add the block above — **including the comment, repeated verbatim, not a pointer to this
   file** — immediately before that file's own `const query = { $and: conditions };`.

The anchor line `const query = { $and: conditions };` is present in all four. Confirm each with:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm/backend/src/controllers/appControllers"
grep -n "datedWindowFor\|\$and: conditions" leadController/paginatedList.js invoiceController/paginatedList.js quoteController/paginatedList.js offerController/paginatedList.js
```
Expected: in each file, one `datedWindowFor` line above one `$and: conditions` line. If a file
shows the require but no call, or the call after the query is built, the window will silently do
nothing — that is the failure this grep catches.

- [ ] **Step 3: Check backend syntax**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs backend
```
Expected: `Syntax check passed — no parse errors.`

- [ ] **Step 4: Harness isolation against the real list controllers**

Create `C:/Users/System Angel/AppData/Local/Temp/table-window-isolation-harness.cjs`. This is the
most important harness in the plan: it must prove the window cannot widen what a child user sees.

Drive the real controllers with a stubbed `Model` that captures the filter object handed to
`find()` and to `countDocuments()` (both must receive the same query), returning a chainable
stub that resolves to `[]`. For each of the five controllers, call it twice — once with no dates
and once with a window — as a **child** account (`parentAdminId` set, role not owner).

Assert for every controller:

1. The windowed query has **exactly one more** `$and` entry than the unwindowed one.
2. Every entry present in the unwindowed query is present, **byte-identical**, in the windowed
   one (`JSON.stringify` equality, entry by entry).
3. The scope entry still carries `createdBy` (the tenant) **and** the `$or` of
   `createdByUser` / `assignedTo` for the child.
4. The date entry is a **separate** entry — it is not merged into the scope entry, and the scope
   entry has no `date`/`created` key of its own.
5. `countDocuments` received the same query object as `find` — a mismatched count is how a
   filtered table ends up showing the wrong page count.
6. With no dates, the query is **unchanged** from the pre-change shape (compare against the same
   conditions list built without the window).

Run: `node "C:/Users/System Angel/AppData/Local/Temp/table-window-isolation-harness.cjs"`
Expected: all checks pass for all five controllers.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers
git commit -m "feat: apply the date window to the dated module list endpoints"
```

---

### Task 8: Populate the assignee on the read paths

**Files:**
- Modify: `backend/src/controllers/middlewaresControllers/createCRUDController/read.js`
- Modify: `backend/src/controllers/appControllers/leadController/read.js:6-10`
- Modify: `backend/src/controllers/appControllers/leadController/migrate.js:38-41`

**Interfaces:**
- Consumes: nothing.
- Produces: a read response whose `assignedTo` is `{_id, name}` when populated and a bare id when
  not. The frontend in Task 9 depends on exactly this.

- [ ] **Step 1: Guard the generic read's populate**

Replace the body of `createCRUDController/read.js` with:
```js
const { scopedFilter } = require('../../../middlewares/ownership');

/**
 * The user references this model actually declares, and only those.
 *
 * Mongoose's strictPopulate throws when asked to populate a path that is not in
 * the schema, and this controller is shared by every entity with no read of its
 * own - Product, Taxes, PaymentMode and Setting among them, none of which have
 * an assignee. Asking for the paths that exist keeps one controller working for
 * all of them, and is why this cannot simply be
 * `.populate('assignedTo', 'name')`.
 *
 * `ref` is the test rather than the path name, because a path called
 * `assignedTo` that is not a reference would resolve to nothing useful anyway.
 */
const userRefsOf = (Model) =>
  ['createdBy', 'createdByUser', 'assignedTo'].filter((path) => {
    const ref = Model.schema.path(path)?.options?.ref;
    return Boolean(ref);
  });

const read = async (Model, req, res) => {
  // Find document by id
  //
  // The scope, but deliberately not userFilter. This fetches ONE record the
  // caller already has the id of, so applying the owner's per-user filter here
  // would not hide a list - it would answer "no such document" for a record the
  // admin can legitimately open, turning a filter into a 404 the moment they
  // clicked a row in their own filtered table. The list and search endpoints
  // honour ?user= because they decide what to show; this one decides whether a
  // thing the caller is entitled to see exists at all, which is a different
  // question and not one a view preference should answer.
  //
  // Note this is a read of one record, not a list: no date window applies here
  // however the table it was opened from is filtered, because the caller
  // already holds the id and asking for it is not a question about a period.
  const query = Model.findOne({
    _id: req.params.id,
    removed: false,
    ...scopedFilter(Model, req),
  });

  const userRefs = userRefsOf(Model);

  if (userRefs.length > 0) {
    query.populate(userRefs.join(' '), 'name');
  }

  const result = await query.exec();

  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    // Return success resposne
    return res.status(200).json({
      success: true,
      result,
      message: 'we found this document ',
    });
  }
};

module.exports = read;
```

- [ ] **Step 2: Populate the lead read**

In `leadController/read.js`, change the query to:
```js
  // `assignedTo` resolves to the Admin's name here rather than being handed over
  // as a bare id, because the client cannot resolve it for itself: /api/team is
  // behind requireTenantOwner, so a Sales Executive reading their own lead has
  // no endpoint that would turn the id into a name. The dashboard's board reads
  // listAll instead, which does not populate - see migrate, which handles both
  // shapes.
  let result = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...leadFilter(req),
  })
    .populate('assignedTo', 'name')
    .exec();
```
Leave the rest of the function, including the `migrate(result)` call and the 404 branch,
unchanged.

- [ ] **Step 3: Normalise the field in `migrate`**

In `leadController/migrate.js`, replace the `newData.assignedTo = result.assignedTo;` line and
the comment above it with:
```js
  /*
   * The assignee, in whichever shape the caller's query produced.
   *
   * This mapper is fed by two different reads. `read` populates the path, so it
   * arrives as an Admin document and the name comes with it - which is the only
   * way a Sales Executive can be shown who a lead belongs to, since /api/team is
   * owner-only. `listAll` and `paginatedList` do not populate, so the same field
   * arrives as a bare ObjectId, which is the shape the pipeline board and its
   * resolveAssignee() expect.
   *
   * Normalised here rather than passed through, so the difference between the
   * two endpoints is visible in one place instead of being a property of
   * whichever populate call happens to be nearby. A populated document would
   * also carry the whole Admin projection, which is more than belongs in a
   * response that only ever displays a name.
   *
   * If listAll ever gains a populate, the board's String(assignedTo) becomes
   * "[object Object]" - change that call site in the same commit.
   */
  if (result.assignedTo && typeof result.assignedTo === 'object') {
    newData.assignedTo = {
      _id: result.assignedTo._id,
      name: result.assignedTo.name ?? null,
    };
  } else {
    newData.assignedTo = result.assignedTo;
  }
```

- [ ] **Step 4: Check backend syntax**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs backend
```
Expected: `Syntax check passed — no parse errors.`

- [ ] **Step 5: Harness the guarded populate and the migrate shapes**

Create `C:/Users/System Angel/AppData/Local/Temp/assignee-populate-harness.cjs`, loading the real
models via `backend/src/models/index.js`. Assert:

1. **For every model in `appModels`**, `read()` runs without throwing. This is the check that
   catches `strictPopulate` on the models with no assignee (Product, Taxes, PaymentMode,
   ProductCategory, Taxes, Setting) — the failure the guard exists to prevent. Use a stubbed
   `Model.findOne` so nothing hits a database, but exercise the real controller.
2. The populate argument set is exactly the declared refs: for `Invoice` it includes `assignedTo`
   and `createdByUser`; for `Product` it is `[]` and **no populate call is made at all**.
3. `migrate` with a populated lead (`{assignedTo:{_id:'x', name:'Ada'}}`) yields
   `assignedTo.name === 'Ada'`, and does **not** leak other Admin keys: assert
   `Object.keys(newData.assignedTo)` is exactly `['_id','name']`.
4. `migrate` with a bare id (`assignedTo:'abc'`) yields `'abc'` — the pipeline's shape, unchanged.
5. `migrate` with `assignedTo` **null and absent** yields `null`/`undefined` and does not throw.
   *(Review Focus 2.)*
6. `migrate` with a populate that resolved to **null** (deleted account) does not throw and yields
   falsy. *(Review Focus 3.)*

Run: `node "C:/Users/System Angel/AppData/Local/Temp/assignee-populate-harness.cjs"`
Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/middlewaresControllers/createCRUDController/read.js backend/src/controllers/appControllers/leadController
git commit -m "fix: resolve the assignee to a name on the read endpoints"
```

---

### Task 9: Render the assignee's name in the Show panel

**Files:**
- Modify: `frontend/src/utils/helpers.js` (add `assigneeLabel` beside `valueByString`)
- Modify: `frontend/src/utils/dataStructure.jsx:8-21` (`dataForRead`)
- Modify: `frontend/src/components/ReadItem/index.jsx:28-33`

**Interfaces:**
- Consumes: the read response shape from Task 8.
- Produces: `assigneeLabel(value)` exported from `@/utils/helpers`, and `isAssignee` on the
  objects `dataForRead` returns.

- [ ] **Step 1: Add the label helper**

Append to `frontend/src/utils/helpers.js`:
```js
/**
 * The display text for an assignee field.
 *
 * The read endpoints populate this path, so it arrives as `{_id, name}`; every
 * other endpoint leaves it a bare id. Both are rendered - the name when the
 * server sent one, the id otherwise - so a field that was not populated shows
 * something meaningful instead of `[object Object]`.
 *
 * A populated path whose account has since been deleted resolves to null, which
 * is rendered as an empty string: the record still exists and still has an
 * assignee id, and the panel should say nothing rather than claim "null".
 */
export const assigneeLabel = (value) => {
  if (!value) return '';
  if (typeof value !== 'object') return value;
  return value.name || value._id || '';
};
```

- [ ] **Step 2: Mark the column**

In `frontend/src/utils/dataStructure.jsx`, in `dataForRead`, add the flag beside `isDate`:
```js
    columns.push({
      title: field.label ? field.label : key,
      dataIndex: field.dataIndex ? field.dataIndex.join('.') : key,
      isDate: field.type === 'date',
      // `disableForTable` keeps this out of the table because it holds a bare
      // ObjectId; the read view is exactly where it belongs, so unlike
      // dataForTable this one does not filter those fields out - it just needs
      // to know how to render it.
      isAssignee: field.type === 'assignee',
    });
```

- [ ] **Step 3: Render the label**

In `frontend/src/components/ReadItem/index.jsx`, extend the import from helpers:
```js
import { assigneeLabel, valueByString } from '@/utils/helpers';
```
and replace the two value lines inside the `useEffect`'s map:
```js
      const isAssignee = props.isAssignee || false;
      let value = valueByString(currentResult, propsKey);
      // Assignee before date: a field is never both, and this order makes the
      // assignee case impossible to fall through to dayjs, which would turn a
      // populated object into an Invalid Date.
      value = isAssignee
        ? assigneeLabel(value)
        : isDate
          ? dayjs(value).format(dateFormat)
          : value;
```

- [ ] **Step 4: Check syntax and build**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs frontend
cd frontend && npm run build
```
Expected: syntax passes, build succeeds.

- [ ] **Step 5: Harness the label against the real components**

Create `C:/Users/System Angel/AppData/Local/Temp/assignee-label-harness.cjs`. Bundle the real
`dataForRead`, the real `assigneeLabel`, and the real `ReadItem` with esbuild, rendering `ReadItem`
through `react-dom/server` with a stubbed `react-redux` `useSelector` returning the fake
`currentResult` and a stubbed crud context. Assert:

1. `dataForRead` marks `assignedTo` as `isAssignee: true` for the real
   `pages/Lead/config.js` field set, and marks no other field.
2. Rendering a lead whose `assignedTo` is `{_id:'x', name:'Ada'}` produces markup containing
   `Ada` and **not** `[object Object]`.
3. Rendering a lead whose `assignedTo` is a bare id string produces that id — the unpopulated
   case still reads.
4. Rendering a lead whose `assignedTo` is **null** produces no `null` text in that row.
   *(Review Focus 2.)*
5. `assigneeLabel(null)` is `''`, and `assigneeLabel({_id:'x'})` is `'x'` — a populated path with
   no name falls back to the id rather than rendering blank. *(Review Focus 3.)*
6. A `date` field still formats through dayjs — the assignee branch did not break it.

Run: `node "C:/Users/System Angel/AppData/Local/Temp/assignee-label-harness.cjs"`
Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/helpers.js frontend/src/utils/dataStructure.jsx frontend/src/components/ReadItem/index.jsx
git commit -m "fix: show the assignee name instead of a raw id in Show views"
```

---

### Task 10: Whole-system verification

**Files:** none modified.

- [ ] **Step 1: Syntax, both projects**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
node superadmin/scripts/check-syntax.cjs frontend
node superadmin/scripts/check-syntax.cjs backend
```
Expected: both report `Syntax check passed — no parse errors.`

- [ ] **Step 2: Production build**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm/frontend" && npm run build
```
Expected: `✓ built in …` with no errors.

- [ ] **Step 3: Re-run every harness**

Run:
```bash
cd "C:/Users/System Angel/AppData/Local/Temp"
node daterange-backend-harness.cjs
node daterange-frontend-harness.cjs
node daterange-slice-harness.cjs
node table-window-harness.cjs
node dated-window-harness.cjs
node table-window-isolation-harness.cjs
node assignee-populate-harness.cjs
node assignee-label-harness.cjs
```
Expected: every one reports all checks passed. The earlier two
(`daterange-backend-harness.cjs` at 58 and `daterange-frontend-harness.cjs` at 41) must still pass
untouched — they cover the helper behaviour this work builds on, so a regression there means the
refactor broke something it should not have.

- [ ] **Step 4: Prove the Super Admin plane did not move**

Re-count the route inventory and compare against the baseline: **lead 9, team 5, superadmin 4, 189
handlers total.** Count by enumerating the `router.route(...)` registrations reachable from
`backend/src/routes/`. Any change to the superadmin count, or to the total, means something was
added or removed that should not have been.

Also confirm no file under `superadmin/` is in the diff:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
git status --porcelain | grep superadmin
```
Expected: no output.

- [ ] **Step 5: Confirm no harness leaked into the repo**

Run:
```bash
cd "F:/3PL Dynamics Internhsip/3PL Dynamics Whole Website/idurar-erp-crm"
git status --porcelain
```
Expected: only the files this plan lists. No `.cjs` harness, no scratch file.

- [ ] **Step 6: Report**

Tell the user, plainly: what changed, the two places the brief's premises did not hold (invoices/
quotes/offers/payments never rendered a user field; "every module" would have emptied the master-data
screens), what could **not** be verified without a browser, and the two things to look at first on
Vercel — that the header control moves the window on Leads/Expenses/Invoices and **not** on
Products, and that a Lead's Show panel names the assignee. Note the Dashboard's own control is gone
because the header now owns it.
