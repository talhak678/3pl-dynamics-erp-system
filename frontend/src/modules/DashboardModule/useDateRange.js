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
 * about it was the dashboard. The window is now set from the app header and read
 * by every module's table, so it has to outlive any one screen and be the same
 * value everywhere - two copies would let the control and the cards disagree
 * about which period is on screen.
 *
 * The return shape is deliberately unchanged, so DateRangeFilter needs no edit
 * and the dashboard keeps working: only the storage moved.
 *
 * The identity guarantee that used to come from useMemo now comes from the
 * selectors - see the note there, and do not unwrap them into plain functions
 * here, because callers' fetch effects depend on that identity to avoid
 * re-fetching on every render.
 */
export default function useDateRange() {
  const dispatch = useDispatch();

  const preset = useSelector(selectDateRangePreset);
  const custom = useSelector(selectDateRangeCustom);
  const range = useSelector(selectDateRangeRange);
  const query = useSelector(selectDateRangeQuery);
  const description = useSelector(selectDateRangeDescription);

  /*
   * Commits a choice. Takes both values together so the preset and the dates can
   * never be updated in two separate renders, which would briefly describe a
   * Custom window with no dates in it.
   *
   * An absent custom range is passed through as undefined rather than as a fresh
   * `{from: null, to: null}`, which is the reducer's default to apply. Building
   * the literal here would give the store a new object on every Apply, and the
   * selectors memoise on that object's identity - so re-applying the preset
   * already in force would recompute the window and hand every module a new one
   * for a value that had not changed.
   */
  const apply = useCallback(
    (nextPreset, nextCustom) => {
      dispatch(dateRange.apply({ preset: nextPreset, custom: nextCustom || undefined }));
    },
    [dispatch]
  );

  /*
   * Back to the default, discarding any custom dates.
   *
   * A complete action rather than a reversal of the radio selection: back to the
   * default means every module shows the default again, in one click, and there
   * is no half-reset state left in the dialog afterwards for the screen and the
   * form to disagree about. The custom dates are cleared rather than kept, so
   * re-opening the dialog on Custom starts from empty instead of restoring a
   * window the user just asked to be rid of.
   */
  const reset = useCallback(() => {
    dispatch(dateRange.reset());
  }, [dispatch]);

  return { preset, custom, range, query, description, apply, reset };
}
