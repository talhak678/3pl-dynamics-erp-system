import { useEffect, useLayoutEffect } from 'react';
import { useDispatch } from 'react-redux';
import { logout as logoutAction } from '@/redux/auth/actions';
import { crud } from '@/redux/crud/actions';
import { erp } from '@/redux/erp/actions';
import PageLoader from '@/components/PageLoader';

/**
 * The sign-out route. Renders a loader and does the work; it draws no UI of its
 * own.
 *
 * There is no navigation here, and that absence is the fix rather than an
 * omission. This page used to navigate to '/login' as soon as it mounted, which
 * is correct in the sign-in route tree and wrong in this one: while the session
 * is still live the app renders the ERP tree, and there '/login' is a route that
 * redirects to '/'. So the imperative navigate raced the store update that ends
 * the session, and whenever it won, the dashboard mounted for a frame - the
 * flash that was reported.
 *
 * Nothing needs to replace it. The dispatch below flips isLoggedIn, which makes
 * apps/ThreePLDynamicsOs swap the whole tree over to AuthRouter, and AuthRouter
 * already maps '/logout' to '/login' with `replace` - so the redirect happens
 * once the session is actually gone, which is the only moment it is correct.
 */
const Logout = () => {
  const dispatch = useDispatch();
  function asyncLogout() {
    dispatch(logoutAction());
  }

  // Layout effect, so the held records and lists are dropped before the tree
  // swaps rather than after it. They belong to the session being ended, and a
  // slice left populated would be the first thing the next account to sign in on
  // this tab was shown.
  useLayoutEffect(() => {
    dispatch(crud.resetState());
    dispatch(erp.resetState());
  }, []);

  useEffect(() => {
    asyncLogout();
  }, []);

  return <PageLoader />;
};
export default Logout;
