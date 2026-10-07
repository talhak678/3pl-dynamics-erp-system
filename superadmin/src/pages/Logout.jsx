import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Spin } from 'antd';

import { logout } from '@/redux/auth/actions';

/**
 * Clearing the session is what actually signs the user out — the logout thunk
 * removes the persisted 'auth' key and asks the server to drop the token from
 * loggedSessions. Once isLoggedIn flips false, SuperAdminOs unmounts this whole
 * tree and renders AuthRouter, which sends /logout on to /login.
 *
 * The dispatch is awaited before navigating. It used to navigate synchronously
 * on the next line, while this tree was still mounted and the URL was still
 * inside it — so the redirect landed before the state that justified it, and
 * anything that kept the session alive (a failed request restoring it, say)
 * stranded the user on a URL this tree has no route for.
 *
 * On failure the session is deliberately restored, so '/' is the right place to
 * send them: it is the Dashboard when signed in and the login screen when not.
 *
 * Uses Spin directly rather than the shared Loading wrapper, which renders Spin
 * around children and so shows nothing when given none.
 */
const LogoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await dispatch(logout());
      // On success this component has already unmounted and AuthRouter owns the
      // redirect; navigating from here would be a stale update.
      if (!cancelled) navigate('/', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <Spin size="large" />
    </div>
  );
};

export default LogoutPage;
