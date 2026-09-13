import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Spin } from 'antd';

import { logout } from '@/redux/auth/actions';

/**
 * Clearing the session is what actually signs the user out — the logout thunk
 * removes the persisted 'auth' key and asks the server to drop the token from
 * loggedSessions. Once isLoggedIn flips false, SuperAdminOs unmounts this whole
 * tree and renders AuthRouter, so the redirect is a formality rather than the
 * mechanism.
 *
 * Uses Spin directly rather than the shared Loading wrapper, which renders Spin
 * around children and so shows nothing when given none.
 */
const LogoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(logout());
    navigate('/login', { replace: true });
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
