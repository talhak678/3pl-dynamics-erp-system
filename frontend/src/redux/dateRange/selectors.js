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
 * The caching is deliberate beyond identity: "today" is fixed at the moment the
 * window was chosen, so a page left open overnight does not silently redefine
 * what its own control still calls "Last 30 days".
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
