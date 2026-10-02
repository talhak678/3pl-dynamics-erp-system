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
