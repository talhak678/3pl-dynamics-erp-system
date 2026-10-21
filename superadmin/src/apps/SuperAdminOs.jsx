import { lazy, Suspense } from 'react';

import { useSelector } from 'react-redux';
import { selectAuth } from '@/redux/auth/selectors';
import PageLoader from '@/components/PageLoader';
import AuthRouter from '@/router/AuthRouter';
import Localization from '@/locale/Localization';
import ErrorBoundary from '@/components/ErrorBoundary';

const SuperAdminApp = lazy(() => import('./SuperAdminApp'));

export default function SuperAdminOs() {
  const { isLoggedIn } = useSelector(selectAuth);

  // Password reset links are public. They can be opened in a browser that
  // already has a session - the same person signed in on another tab, or a
  // shared machine - and the protected tree has no route for either screen.
  // Without this, such a link would land on the in-app 404 instead of the form.
  // Showing these screens does not end the existing session; a successful reset
  // clears the local one explicitly, because the server retires every session
  // when the password changes.
  const isPasswordFlow =
    window.location.pathname.startsWith('/forgetpassword') ||
    window.location.pathname.startsWith('/resetpassword');

  if (!isLoggedIn || isPasswordFlow)
    return (
      <Localization>
        <AuthRouter />
      </Localization>
    );

  return (
    <Localization>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <SuperAdminApp />
        </Suspense>
      </ErrorBoundary>
    </Localization>
  );
}
