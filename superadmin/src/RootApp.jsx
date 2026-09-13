import './style/app.css';

import { Suspense, lazy } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from '@/redux/store';
import PageLoader from '@/components/PageLoader';
import ErrorBoundary from '@/components/ErrorBoundary';

const SuperAdminOs = lazy(() => import('./apps/SuperAdminOs'));

export default function RootApp() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Provider store={store}>
          <Suspense fallback={<PageLoader />}>
            <SuperAdminOs />
          </Suspense>
        </Provider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
