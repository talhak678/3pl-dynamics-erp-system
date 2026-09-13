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

  if (!isLoggedIn)
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
