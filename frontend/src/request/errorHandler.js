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

  // Read once, up front. Two decisions below depend on it, and both have to see
  // the same value: what to tell the user, and whether the sign-out flag is
  // still ours to clear.
  const signingOut = isSigningOut();

  window.localStorage.removeItem('auth');

  // The sign-out flag is left alone while a sign-out is under way, because
  // redux/auth/actions.js owns it: it clears the flag itself when the logout
  // request fails, and the next successful sign-in clears it otherwise. This
  // file reads the flag to know which requests are expected to fail, so
  // clearing it here ends that window early — and the second of two replies to
  // a pair of residual requests then finds the window shut and puts a raw
  // technical string on the sign-in page. Which is the bug this guards.
  if (!signingOut) {
    window.localStorage.removeItem('isLogout');
  }

  // A sign-out owns its own navigation. Redirecting here would be a full page
  // load in the middle of the logout flow, which can abort the logout request
  // still in flight and leave the session alive on the server. Today the flag
  // cannot be set while 'auth' is still present, but relying on the ordering
  // inside another file for that is not a guarantee worth keeping.
  const willRedirect = hadSession && !signingOut && !isOnSignInPage();

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

// --- Module-access refusals -------------------------------------------------
//
// The dashboard asks for a summary of every entity at once, so a tenant granted
// only some modules collects a burst of these — one 403 per module they lack.
// Left to the generic path each one stacked its own "Request error 403" toast
// and buried the screen.
//
// Two things fix that: a branch of their own, so they never reach the generic
// toast at all, and a single fixed notification key. antd updates a
// notification in place when the key matches rather than adding another, so a
// burst of any size collapses into one message — and the wording reads the same
// whether one call failed or six, which is why it says "some modules" rather
// than naming any.
//
// Both the key and the wording are exported because the dashboard raises the
// same notice a second way: proactively, from the permissions themselves rather
// than from a failed call. Sharing one key means the two can never stack two
// near-identical messages, and sharing one string means they can never disagree
// about what it says.
export const UPGRADE_NOTIFICATION_KEY = 'module-access-denied';

export const UPGRADE_MESSAGE =
  'Your account does not have access to some modules. Some functions may not work. Please contact our support team to upgrade.';

// The guard's structured `module` field is the real signal. The wording is a
// fallback so this keeps working if the bundle ships ahead of the server.
const MODULE_DENIED_PATTERN = /does not have access to the .+ module/i;

const isModuleDeniedResponse = (response) =>
  response?.status === 403 &&
  (typeof response?.data?.module === 'string' ||
    MODULE_DENIED_PATTERN.test(response?.data?.message || ''));

// --- Requests that raced the token being cleared -----------------------------
//
// The sign-out flow clears 'auth' and only then calls the API, so replies can
// land while the session is already gone. What comes back is the JWT library
// talking to itself — "jwt malformed", "jwt expired", "invalid signature" —
// which means nothing to a tenant. Matching on "jwt" alone covers that whole
// family of messages.
const TECHNICAL_TOKEN_PATTERN = /jwt|invalid signature|invalid token|secret or public key/i;

const isTechnicalTokenMessage = (message) =>
  Boolean(message) && TECHNICAL_TOKEN_PATTERN.test(String(message));

/**
 * True while a sign-out the user asked for is in flight, or has just finished.
 *
 * localStorage['isLogout'] is raised by the logout action immediately before it
 * clears 'auth', and cleared again on the next successful sign-in — so it marks
 * exactly the window in which a failing request is expected rather than worth
 * reporting. Anything arriving in that window is swallowed. Without this,
 * signing out puts a raw "jwt malformed" banner on the sign-in page.
 */
const isSigningOut = () => {
  try {
    const raw = window.localStorage.getItem('isLogout');
    return Boolean(raw && JSON.parse(raw)?.isLogout);
  } catch (error) {
    // Unparseable flag. Treat it as absent rather than risk leaking the banner.
    return false;
  }
};

// What a session that ended for a reason the server worded technically is told
// instead. "jwt expired" and "jwt malformed" are the JWT library talking to
// itself; this is the same event said in words a tenant can act on. The session
// ending is not a failure they caused or can debug, but being bounced to a
// sign-in page with no explanation at all is its own small mystery.
export const SESSION_ENDED_MESSAGE = 'Your session has ended, please sign in again.';

/**
 * What to tell the user about a session the server has declared dead, given the
 * server's own wording. Returns '' when there is nothing worth saying.
 *
 * Derived from the response before endDeadSession runs, so the reason shown and
 * the teardown performed can never disagree about the same reply. That ordering
 * used to be load-bearing — endDeadSession cleared the sign-out flag this reads,
 * so resolving the notice afterwards made every sign-out look like a genuine
 * expiry. It no longer clears that flag mid-sign-out, but reading the reply
 * before acting on it is still the order that reads correctly.
 */
const sessionEndNotice = (message) => {
  // The user asked to sign out and this is a request that raced the teardown.
  // There is nothing to explain, and saying "your session has ended" to someone
  // who just ended it themselves would read as an error.
  if (isSigningOut()) return '';

  // A real expiry, described by the JWT library rather than by our API.
  if (isTechnicalTokenMessage(message)) return SESSION_ENDED_MESSAGE;

  // A message from our own API — a suspension, usually — is already worded for
  // a person, so it is passed through. The fallback covers the case of no
  // message at all: a dead session with no explanation is worse than a generic
  // one, and silence here would look like a session that simply vanished.
  return message || SESSION_ENDED_MESSAGE;
};

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

    // Two reasons to say nothing at all: the user asked to sign out and this is
    // a request that raced the token being cleared, or the server is relaying
    // the JWT library's own wording. Either way there is nothing a tenant can
    // act on. The first is silent; the second gets the friendly line. The
    // session is torn down either way.
    const notice = sessionEndNotice(message);

    endDeadSession(notice);

    // An empty notice is the sign-out case, which shows nothing. There is no
    // codeMessage fallback here because every response carrying jwtExpired also
    // carries a message — and a fallback would have to fire during a sign-out,
    // where the silence is the whole point.
    if (notice) {
      notification.config({
        duration: 20,
        maxCount: 1,
      });
      notification.error({
        message: notice,
      });
    }

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
      // Deliberately NOT silenced during a sign-out, even though the other
      // branches are. This bare form — no jwtExpired flag — comes only from the
      // sign-in endpoint, so reaching here means someone is trying to log in.
      // The sign-out flag outlives a logout until the next successful sign-in,
      // so silencing this would answer a suspended user's login attempt with
      // nothing at all: no toast, no reason, a form that appears to do nothing.
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

    // A restricted module, refused by middlewares/requireModuleAccess.js.
    //
    // Checked after the suspension test above and returning before the generic
    // toast below. A suspended account carries jwtExpired and no `module` field,
    // so the two can never match the same response — the order just makes that
    // explicit.
    //
    // No notification.config() call here, deliberately. `maxCount` is global to
    // antd, so setting it to 1 would also throw away unrelated errors the user
    // still needs to see. The fixed key is what collapses the burst, and it does
    // so without any side effect on other notifications. `duration` is set
    // because whatever the previous branch configured would otherwise apply —
    // a burst of refusals can leave a 20-second toast behind.
    if (isModuleDeniedResponse(response)) {
      notification.error({
        key: UPGRADE_NOTIFICATION_KEY,
        message: UPGRADE_MESSAGE,
        duration: 6,
      });

      return response.data;
    }

    // A token the JWT library rejected outright. Handled before the generic
    // toast rather than after it, so the raw reason never reaches the screen —
    // which now means the friendly line rather than silence, except during a
    // sign-out, which stays silent. This is the case that used to leave a "jwt
    // malformed" banner behind on the sign-in page.
    if (response?.data?.error?.name === 'JsonWebTokenError') {
      endDeadSession(sessionEndNotice(message));
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

    return response.data;
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
