import * as actionTypes from './types';
import { DEFAULT_DATE_RANGE_PRESET } from '@/utils/dateRange';

/*
 * A shared constant rather than a fresh literal, because the reducer returns it
 * and the derived selectors memoise on the object's identity. A new
 * `{from: null, to: null}` on every reset would be a new input, and the window
 * would be recomputed - and re-fetched - for a value that did not change.
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
        /*
         * Applied together so the store can never briefly describe a Custom
         * window with no dates in it. Falls back to the shared empty pair, so
         * applying a preset leaves the same reference behind that a reset does.
         */
        custom: action.payload.custom || NO_CUSTOM_RANGE,
      };
    case actionTypes.DATE_RANGE_RESET:
      return INITIAL_STATE;
    default:
      return state;
  }
};

export default dateRangeReducer;
