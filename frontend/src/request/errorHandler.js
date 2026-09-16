import { notification } from 'antd';
import codeMessage from './codeMessage';

// Carries the sign-out reason across the page reload that ends the session.
// Exported so the sign-in page can pick it up and show it — see endDeadSession.
export const SESSION_ENDED_KEY = 'sessionEndedReason';

// The sign-in routes. A dead session must not redirect while the user is
// already here, or a 401 from a retry would reload the page in a loop and wipe
// whatever they had typed.
const isOnSignInPage = () => {
  const { pathname } = window.location;
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/logout') ||
    pathname.startsWith('/forgetpassword') ||
    pathname.startsWith('/resetpassword')
  );
};

/**
 * Ends a session the server has already declared dead: clears the persisted
 * credentials, records why, and returns the user to the sign-in page.
 *
 * The redirect is a full page load rather than a router navigation on purpose.
 * What we are escaping is an unknown number of components stuck mid-request
 * behind a 403; reloading is the only way to guarantee every one of them is
 * torn down and every in-flight request abandoned.
 *
 * That reload also destroys the toast, which is why the message is stashed in
 * sessionStorage first — the sign-in page reads it back and displays it. Without
 * that the user would be silently ejected with no idea what happened.
 */
const endDeadSession = (message) => {
  const hadSession = Boolean(window.localStorage.getItem('auth'));

  window.localStorage.removeItem('auth');
  window.localStorage.removeItem('isLogout');

  const willRedirect = hadSession && !isOnSignInPage();

  // Only worth stashing when a reload is coming. With no session there is
  // nowhere to redirect to and the toast survives on its own.
  if (willRedirect && message) {
    try {
      window.sessionStorage.setItem(SESSION_ENDED_KEY, message);
    } catch (error) {
      // Private mode, or storage disabled. The sign-out still has to happen; it
      // just arrives without an explanation.
      console.error('Could not record the sign-out reason:', error);
    }
  }

  if (willRedirect) {
    window.location.href = '/login';
  }
};

// A suspended account reaches the client two different ways: the API guard
// flags it with jwtExpired, while the sign-in endpoint returns a bare 403.
// Matching the wording as well means the sign-out keeps working even if this
// bundle is deployed ahead of the server.
const SUSPENDED_PATTERN = /account suspended/i;

const isSuspendedResponse = (response) =>
  response?.status === 403 && SUSPENDED_PATTERN.test(response?.data?.message || '');

const errorHandler = (error) => {
  if (!navigator.onLine) {
    notification.config({
      duration: 15,
      maxCount: 1,
    });
    // Code to execute when there is internet connection
    notification.error({
      message: 'No internet connection',
      description: 'Cannot connect to the Internet, Check your internet network',
    });
    return {
      success: false,
      result: null,
      message: 'Cannot connect to the server, Check your internet network',
    };
  }

  const { response } = error;

  if (!response) {
    notification.config({
      duration: 20,
      maxCount: 1,
    });
    // Code to execute when there is no internet connection
    // notification.error({
    //   message: 'Problem connecting to server',
    //   description: 'Cannot connect to the server, Try again later',
    // });
    return {
      success: false,
      result: null,
      message: 'Cannot connect to the server, Contact your Account administrator',
    };
  }

  // Server says this session is over — an expired token, a session signed out
  // elsewhere, or a suspended account. Either way there is nothing left to do
  // but clear it and start again. Returning here matters: without it execution
  // would fall through and stack a generic "Request error" toast on top of the
  // redirect.
  if (response.data && response.data.jwtExpired) {
    const message = response.data.message;

    endDeadSession(message);

    notification.config({
      duration: 20,
      maxCount: 1,
    });
    notification.error({
      message: message || codeMessage[response.status],
    });

    return { success: false, result: null, message };
  }

  if (response && response.status) {
    const message = response.data && response.data.message;

    // A suspended account caught mid-session. Shown as the server worded it,
    // with no "Request error 403" wrapper in front of it.
    //
    // Note what is deliberately NOT matched here: the 403 from the module guard,
    // whose message reads "does not have access to the invoice module". That is
    // a healthy session being refused one module, and signing the user out over
    // it would throw them out of the entire app for clicking a stale menu item.
    if (isSuspendedResponse(response)) {
      endDeadSession(message);

      notification.config({
        duration: 20,
        maxCount: 1,
      });
      notification.error({
        message,
      });

      return { success: false, result: null, message };
    }

    const errorText = message || codeMessage[response.status];
    const { status, error } = response;
    notification.config({
      duration: 20,
      maxCount: 2,
    });
    notification.error({
      message: `Request error ${status}`,
      description: errorText,
    });

    if (response?.data?.error?.name === 'JsonWebTokenError') {
      window.localStorage.removeItem('auth');
      window.localStorage.removeItem('isLogout');
      window.location.href = '/logout';
    } else return response.data;
  } else {
    notification.config({
      duration: 15,
      maxCount: 1,
    });

    if (navigator.onLine) {
      // Code to execute when there is internet connection
      notification.error({
        message: 'Problem connecting to server',
        description: 'Cannot connect to the server, Try again later',
      });
      return {
        success: false,
        result: null,
        message: 'Cannot connect to the server, Contact your Account administrator',
      };
    } else {
      // Code to execute when there is no internet connection
      notification.error({
        message: 'No internet connection',
        description: 'Cannot connect to the Internet, Check your internet network',
      });
      return {
        success: false,
        result: null,
        message: 'Cannot connect to the server, Check your internet network',
      };
    }
  }
};

export default errorHandler;
