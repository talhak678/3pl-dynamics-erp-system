import { API_BASE_URL } from '@/config/serverApiConfig';

import axios from 'axios';
import errorHandler from '@/request/errorHandler';
import successHandler from '@/request/successHandler';
import { includeToken } from '@/request';

export const login = async ({ loginData }) => {
  try {
    const response = await axios.post(
      API_BASE_URL + `login?timestamp=${new Date().getTime()}`,
      loginData
    );

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
    const response = await axios.post(API_BASE_URL + `register`, registerData);

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
    const response = await axios.get(API_BASE_URL + `verify/${userId}/${emailToken}`);

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
    const response = await axios.post(API_BASE_URL + `resetpassword`, resetPasswordData);

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
 * rather than assumed.
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
    const response = await axios.get(API_BASE_URL + `auth/me?timestamp=${new Date().getTime()}`);

    return response.data;
  } catch (error) {
    return errorHandler(error);
  }
};

/**
 * Revokes the session on the server.
 *
 * The includeToken() call is not decoration. Every other call in this file goes
 * out unauthenticated on purpose — they are the endpoints reached while signed
 * out — but logout is behind isValidAuthToken and is the one request that has to
 * arrive carrying the token it is retiring. Without this the header was whatever
 * the last request.* helper happened to leave on the shared axios instance: set
 * if the user had loaded a page since the last sign-in, absent if they had not,
 * and freshly deleted if anything re-rendered and fetched during the teardown.
 * The absent case is the one that was reported — the guard answered "No
 * authentication token, authorization denied.", refused the request before the
 * handler could revoke anything, and left the session alive.
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
    const response = await axios.post(API_BASE_URL + `logout?timestamp=${new Date().getTime()}`);
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
