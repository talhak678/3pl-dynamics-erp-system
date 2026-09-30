import { useCallback, useMemo, useState } from 'react';

import {
  DEFAULT_DATE_RANGE_PRESET,
  describeRange,
  rangeForPreset,
  rangeToQuery,
} from './dateRange';

/**
 * Holds the dashboard's chosen window and hands back the query parameters for it.
 *
 * The chosen preset is held here rather than inside the dialog because the
 * dashboard's fetch effect has to depend on it: the window is part of the
 * question being asked of the server, so a change to it has to be a change to
 * that effect's inputs or the cards would keep showing the old window.
 *
 * Only the applied state lives here. The dialog keeps its own draft copy while
 * it is open - see DateRangeFilter - so clicking through the radio options does
 * not re-fetch the whole page until Apply is pressed.
 */
export default function useDateRange() {
  const [preset, setPreset] = useState(DEFAULT_DATE_RANGE_PRESET);
  const [custom, setCustom] = useState({ from: null, to: null });

  /*
   * Read out of `custom` before memoising, because an object is a new object on
   * every render. Depending on the pair of primitives instead means `range`
   * below is recomputed only when a date really changed.
   */
  const { from, to } = custom;

  const customRange = useMemo(() => ({ from, to }), [from, to]);

  /*
   * Memoised, and this is load-bearing rather than an optimisation: `range`
   * carries dayjs objects built from the current time, so recomputing it on
   * every render would hand the fetch effect brand new start and end instants
   * each time - a new effect input on every render, and therefore a fetch on
   * every render, forever.
   *
   * The consequence of caching it is that "today" is fixed at the moment the
   * range was chosen rather than at each request. That is the behaviour worth
   * having: a dashboard left open overnight would otherwise silently redefine
   * its own window, and a re-fetch triggered by anything else would return
   * different numbers for what the button still calls "Last 30 days".
   */
  const range = useMemo(() => rangeForPreset(preset, customRange), [preset, customRange]);

  /*
   * Empty when there is no usable window, which is the signal every summary
   * endpoint reads as "no date filter" - see utils/dateRange.js on the server.
   * It can only be reached through a Custom range that was never valid, and the
   * dialog will not apply one of those, so this is a guard rather than a state
   * the user can arrange.
   */
  const query = useMemo(() => rangeToQuery(range), [range]);

  /*
   * Commits a choice. Takes both values together so the preset and the dates can
   * never be updated in two separate renders, which would briefly describe a
   * Custom window with no dates in it.
   */
  const apply = useCallback((nextPreset, nextCustom) => {
    setPreset(nextPreset);
    setCustom(nextCustom || { from: null, to: null });
  }, []);

  /*
   * Back to the default, discarding any custom dates.
   *
   * A complete action rather than a reversal of the radio selection: back to the
   * default means the dashboard shows the default again, in one click, and there
   * is no half-reset state left in the dialog afterwards for the screen and the
   * form to disagree about. The custom dates are cleared rather than kept, so
   * re-opening the dialog on Custom starts from empty instead of restoring a
   * window the user just asked to be rid of.
   */
  const reset = useCallback(() => {
    setPreset(DEFAULT_DATE_RANGE_PRESET);
    setCustom({ from: null, to: null });
  }, []);

  const description = describeRange(preset, customRange);

  return { preset, custom, range, query, description, apply, reset };
}
