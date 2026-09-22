import * as actionTypes from './types';
import * as authService from '@/auth';
import { request, includeToken } from '@/request';

export const login =
  ({ loginData }) =>
  async (dispatch) => {
    dispatch({
      type: actionTypes.REQUEST_LOADING,
    });
    const data = await authService.login({ loginData });

    if (data.success === true) {
      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({
        type: actionTypes.REQUEST_FAILED,
      });
    }
  };

export const register =
  ({ registerData }) =>
  async (dispatch) => {
    dispatch({
      type: actionTypes.REQUEST_LOADING,
    });
    const data = await authService.register({ registerData });

    if (data.success === true) {
      dispatch({
        type: actionTypes.REGISTER_SUCCESS,
      });
    } else {
      dispatch({
        type: actionTypes.REQUEST_FAILED,
      });
    }
  };

export const verify =
  ({ userId, emailToken }) =>
  async (dispatch) => {
    dispatch({
      type: actionTypes.REQUEST_LOADING,
    });
    const data = await authService.verify({ userId, emailToken });

    if (data.success === true) {
      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({
        type: actionTypes.REQUEST_FAILED,
      });
    }
  };

export const resetPassword =
  ({ resetPasswordData }) =>
  async (dispatch) => {
    dispatch({
      type: actionTypes.REQUEST_LOADING,
    });
    const data = await authService.resetPassword({ resetPasswordData });

    if (data.success === true) {
      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({
        type: actionTypes.REQUEST_FAILED,
      });
    }
  };

/**
 * Signs the account out.
 *
 * The ordering here is the whole function, and it is the reverse of what it was.
 * Three things have to hold at once, and each one is a bug that was reported.
 *
 * 1. The request reaches the server authenticated. POST /api/logout sits behind
 *    isValidAuthToken, so a request sent without the Authorization header is
 *    refused at the guard - and because the guard returns before the handler,
 *    the token is never revoked from loggedSessions and the session survives the
 *    sign-out that appeared to fail. The endpoint is therefore called while
 *    'auth' is still stored.
 *
 * 2. Nothing is torn down before that request is sent. 'auth' in localStorage and
 *    the axios Authorization header are the same fact held twice, and
 *    includeToken() deletes the header when it finds no token. So clearing 'auth'
 *    first opened a window in which any component re-rendering for its own
 *    reasons - the resetState dispatches in pages/Logout.jsx, an unmounting
 *    overview - could call includeToken() and strip the header, after which the
 *    logout request went out unauthenticated and hit exactly the refusal above.
 *    That window is what the reported "No authentication token, authorization
 *    denied." came out of, and closing it is why the call comes first.
 *
 * 3. The screen does not wait on the network. authService.logout() invokes
 *    axios.post synchronously before its first await, and this app registers no
 *    axios interceptors, so by the time it hands back its promise the header is
 *    already merged into the request config. Tearing down straight after is
 *    therefore safe - the request is in flight and authenticated - and the user
 *    is returned to the sign-in page without a round trip.
 *
 * The failure path is gone deliberately. It used to restore the saved session
 * and clear the isLogout flag whenever the API refused, which did three bad
 * things at once: it put the user back into a session they had just asked to
 * leave; it left them on /logout, whose ERP route tree resolves to the dashboard,
 * so the app rendered the dashboard for a frame before the redirect caught up;
 * and it lowered the flag that marks a 401 as expected, so the very reply that
 * caused the refusal was then reported raw. The banner on the sign-in page was
 * the last of those. Signing out is the user's instruction and does not depend
 * on the server agreeing: the local session ends either way, and a token the
 * server still holds lapses with its own expiry.
 */
export const logout = () => async (dispatch) => {
  // Raised before anything is torn down, and left raised. Every request that
  // races this teardown is expected to fail - its token is being retired - and
  // this flag is what tells errorHandler to swallow those replies rather than
  // put a dead-session banner on the sign-in page. It is cleared by the next
  // successful sign-in rather than here, because the requests it covers are the
  // ones still in flight after this thunk has returned.
  window.localStorage.setItem('isLogout', JSON.stringify({ isLogout: true }));

  // Fired, not awaited - see (1) and (3) above. Held in a variable rather than
  // dropped so the thunk still resolves only after the call settles, which is
  // what keeps a caller from racing the revocation.
  const revocation = authService.logout();

  // The local session ends here, whatever the server says. Both keys go: the
  // settings row that was loaded for this tenant belongs to the session, and
  // leaving it behind would show the next account the last one's currency and
  // date format until its own settings arrived.
  window.localStorage.removeItem('auth');
  window.localStorage.removeItem('settings');

  // Drops the Authorization header from the shared axios instance. Called now
  // that 'auth' is gone, so it takes its removal path - the token it just sent
  // is not left on the instance for every later request to carry.
  includeToken();

  dispatch({ type: actionTypes.LOGOUT_SUCCESS });

  // Awaited only so this thunk resolves after the request settles. The catch is
  // not error handling - errorHandler has already turned a failed revocation
  // into a return value - it is there because the teardown above is complete and
  // has nothing left to undo, and an escape from here would arrive as an
  // unhandled rejection from a dispatch that nothing awaits.
  await revocation.catch(() => {});
};

/**
 * Re-reads this account's own permissions and folds them into the live session.
 *
 * Module grants are copied into the session at sign-in and read from there by
 * everything that decides what to draw: the sidebar, RequireModule, RequireOwner,
 * RequireSalesPipeline, the dashboard's module cards. A Customer Admin changing
 * an employee's grants therefore changes a row that employee's browser has no way
 * of hearing about, and the stale copy stays authoritative for as long as the
 * token lasts - which is why the change used to need a sign-out to be seen. This
 * is the sync that closes that gap, dispatched once per page load from apps/
 * ErpApp.jsx.
 *
 * It is a refresh, not a sign-in: it does not change whether the user is signed
 * in, does not touch the token, and draws nothing while it runs. A failure is
 * silent here because errorHandler has already dealt with it - a dead session is
 * torn down by the handler, and anything less than that is not worth interrupting
 * the page for.
 *
 * The two guards below are the same check made before and after the round trip,
 * and both are needed. The first skips the request for an account with no session
 * to refresh. The second is the one that matters: a sign-out can land inside this
 * request, and without it the reply would write a session back into localStorage
 * and into redux for a user who has just signed out - which is the resurrected
 * session that the logout flow no longer has a rollback to clean up.
 */
export const refreshSession = () => async (dispatch, getState) => {
  const before = getState().auth;

  if (!before || before.isLoggedIn !== true || !before.current || !before.current.token) return;

  const data = await authService.me();

  if (!data || data.success !== true || !data.result) return;

  // Re-read rather than reusing `before`. The session is not guaranteed to be
  // the one this request started under.
  const after = getState().auth;

  if (!after || after.isLoggedIn !== true || !after.current || !after.current.token) return;

  // The reply overwrites everything the server owns; the token is carried over
  // explicitly because the endpoint does not return one - deliberately, since
  // the caller is already holding a working token and a fresh JWT per page load
  // would quietly turn a 24-hour session into one that never ends. Spreading
  // `after.current` first keeps whatever else the session holds, `maxAge` among
  // it, for the same reason: this replaces the fields it knows about and leaves
  // the rest of the session as it found it.
  const current = { ...after.current, ...data.result, token: after.current.token };

  // Written to both, and the order matters in neither direction: redux is what
  // the running page renders from, localStorage is what the next reload boots
  // from, and a refresh that updated only one would be undone by the other.
  window.localStorage.setItem(
    'auth',
    JSON.stringify({ current, isLoggedIn: true, isLoading: false, isSuccess: true })
  );

  dispatch({ type: actionTypes.REQUEST_SUCCESS, payload: current });
};

export const updateProfile =
  ({ entity, jsonData }) =>
  async (dispatch) => {
    let data = await request.updateAndUpload({ entity, id: '', jsonData });

    if (data.success === true) {
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
    }
  };
