import axios from 'axios';
import errorHandler from '@/request/errorHandler';
import successHandler from '@/request/successHandler';
import { includeToken } from '@/request';

/**
 * The auth service.
 *
 * Every call in here has the same two-step shape, and the order is load-bearing:
 *
 *   includeToken();                                   // points axios at the API
 *   axios.post('login?timestamp=...')                 // relative path, no slash
 *
 * includeToken() sets axios.defaults.baseURL to '/api/', and axios only skips
 * that base when the request URL is *absolute* - meaning it matches
 * /^([a-z][a-z\d+\-.]*:)?\/\//, i.e. it opens with a scheme ('https://') or a
 * protocol-relative '//'. A single leading '/' is NOT absolute. So axios reads
 * '/api/login' as a relative path and joins it onto the base, and the request
 * goes out as '/api/api/login' - the base's '/api/' plus the one spelled into
 * the string. That is the double prefix that was reported: /api/api/auth/me and
 * /api/api/logout, each answered 404 "Api url doesn't exist".
 *
 * Spelling only the path - 'login', not '/api/login' and not API_BASE_URL +
 * 'login' - leaves the single '/api/' to the base, which is where every other
 * call in this app already gets it from. request/request.js builds its URLs the
 * same way: 'invoice/create', never '/api/invoice/create'.
 *
 * Calling includeToken() first is what makes the relative form safe rather than
 * merely shorter. Axios resolves the URL at call time from whatever baseURL is
 * set *then*, and this file is where the app is reached with no session at all:
 * on a cold /login page nothing has run to set a base, so a bare 'login' would
 * have resolved against the page instead of the API. Establishing the base
 * immediately before each call makes the relative form correct in every state -
 * first request of a page load, and thousandth - rather than correct only when
 * some earlier request happened to have run.
 *
 * It is also what gets the Authorization header right, which matters here more
 * than elsewhere: these are the endpoints reached while signed out, and a token
 * left on the shared axios instance by a previous session must not be carried
 * into a fresh sign-in. includeToken() reads the stored session and deletes the
 * header when there is none.
 */
export const login = async ({ loginData }) => {
  try {
    includeToken();
    const response = await axios.post(`login?timestamp=${new Date().getTime()}`, loginData);

    const { status, data } = response;

    successHandler(
      { data, status },
      {
        notifyOnSuccess: false,
        notifyOnFailed: true,
      }
    );
    return data;
  } catch (error) {
    return errorHandler(error);
  }
};

export const register = async ({ registerData }) => {
  try {
    includeToken();
    const response = await axios.post(`register`, registerData);

    const { status, data } = response;

    successHandler(
      { data, status },
      {
        notifyOnSuccess: true,
        notifyOnFailed: true,
      }
    );
    return data;
  } catch (error) {
    return errorHandler(error);
  }
};

export const verify = async ({ userId, emailToken }) => {
  try {
    includeToken();
    const response = await axios.get(`verify/${userId}/${emailToken}`);

    const { status, data } = response;

    successHandler(
      { data, status },
      {
        notifyOnSuccess: true,
        notifyOnFailed: true,
      }
    );
    return data;
  } catch (error) {
    return errorHandler(error);
  }
};

export const resetPassword = async ({ resetPasswordData }) => {
  try {
    includeToken();
    const response = await axios.post(`resetpassword`, resetPasswordData);

    const { status, data } = response;

    successHandler(
      { data, status },
      {
        notifyOnSuccess: true,
        notifyOnFailed: true,
      }
    );
    return data;
  } catch (error) {
    return errorHandler(error);
  }
};

/**
 * Re-reads the signed-in account's own profile, so a permission change made by
 * this account's Customer Admin lands on a page refresh instead of waiting for a
 * sign-out.
 *
 * The includeToken() call is what makes this work at all on a cold load. This is
 * the first request a refreshed page makes in most cases, and on a fresh page
 * load the shared axios instance has no Authorization header yet - nothing has
 * run to set one. Sent without it, the endpoint's guard would answer "No
 * authentication token, authorization denied." and, because that reply carries
 * jwtExpired, errorHandler would read a perfectly healthy session as a dead one
 * and sign the user out on every refresh. So the header is established here
 * rather than assumed - and for the same reason the path is relative, since
 * includeToken() is also what points the request at the API at all.
 *
 * No successHandler. Every other call in this file produces something the user
 * asked for and is worth reporting on; this one runs unprompted in the
 * background, and announcing it would be noise. Failures still go through
 * errorHandler, which is the point: a refresh that comes back 401 means the
 * session really has ended - the token was revoked, the account was suspended or
 * deleted - and that teardown is exactly what should happen. It is also what
 * gives the account kill switch a client-side trigger on refresh, not just on
 * the token's own expiry.
 */
export const me = async () => {
  try {
    includeToken();
    const response = await axios.get(`auth/me?timestamp=${new Date().getTime()}`);

    return response.data;
  } catch (error) {
    return errorHandler(error);
  }
};

/**
 * Revokes the session on the server.
 *
 * The includeToken() call is not decoration. This request is behind
 * isValidAuthToken and is the one that has to arrive carrying the token it is
 * retiring. Without it the header was whatever the last request.* helper happened
 * to leave on the shared axios instance: set if the user had loaded a page since
 * the last sign-in, absent if they had not, and freshly deleted if anything
 * re-rendered and fetched during the teardown. The absent case is the one that
 * was reported - the guard answered "No authentication token, authorization
 * denied.", refused the request before the handler could revoke anything, and
 * left the session alive.
 *
 * Note the ordering consequence for the caller: this runs synchronously up to
 * the axios.post, and this app registers no interceptors, so once this function
 * has been *called* the header is already merged into the request config and the
 * caller may clear the session immediately without waiting for the round trip.
 * redux/auth/actions.js relies on exactly that.
 */
export const logout = async () => {
  axios.defaults.withCredentials = true;
  try {
    includeToken();
    const response = await axios.post(`logout?timestamp=${new Date().getTime()}`);
    const { status, data } = response;

    successHandler(
      { data, status },
      {
        notifyOnSuccess: false,
        notifyOnFailed: true,
      }
    );
    return data;
  } catch (error) {
    return errorHandler(error);
  }
};
