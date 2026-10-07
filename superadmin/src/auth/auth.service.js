import { API_BASE_URL } from '@/config/serverApiConfig';

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
 * '/api/logout' as a relative path and joins it onto the base, and the request
 * goes out as '/api/api/logout' - the base's '/api/' plus the one spelled into
 * the string. That is the double prefix that was reported, answered 404
 * "Api url doesn't exist".
 *
 * Spelling only the path - 'logout', not '/api/logout' and not API_BASE_URL +
 * 'logout' - leaves the single '/api/' to the base, which is where every other
 * call in this app already gets it from. request/request.js builds its URLs the
 * same way: 'admin/list', never '/api/admin/list'.
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
 * This mirrors frontend/src/auth/auth.service.js, which carries the same fix for
 * the same reason. Keep the two in step.
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

export const logout = async () => {
  try {
    // window.localStorage.clear();
    //
    // Deliberately NOT includeToken(), unlike every call above.
    //
    // The redux thunk removes 'auth' from localStorage *before* calling this, so
    // includeToken() would read no session, find no token, and delete the
    // Authorization header - and /logout is mounted behind
    // adminAuth.isValidAuthToken on the server, so the request would come back
    // 401 instead of signing anyone out. The header is still attached from the
    // requests that loaded the dashboard, and the server has not invalidated the
    // token yet, so it is the right one to send.
    //
    // Only the base is set here, which is safe either way and means the relative
    // path below cannot resolve against the page if this happens to be the first
    // request of a page load.
    axios.defaults.baseURL = API_BASE_URL;
    axios.defaults.withCredentials = true;
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
