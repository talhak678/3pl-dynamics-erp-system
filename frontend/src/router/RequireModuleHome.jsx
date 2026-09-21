import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import AccessDenied from '@/components/AccessDenied';
import { landingPathFor } from './moduleHome';

/**
 * Route guard for `/`, the page a sign-in lands on.
 *
 * Without this, an account that was never granted `dashboard` is refused the
 * page it is sent to immediately after signing in - a 403 as the first thing a
 * new user sees, with the modules they DO have reachable only by finding them in
 * the sidebar. Redirecting to the first module they hold turns that into a
 * working landing.
 *
 * A redirect rather than a render, so the URL matches the page: the sidebar
 * highlights the right entry, and a refresh lands in the same place.
 *
 * The fallback is AccessDenied rather than the dashboard, because the dashboard
 * is the one page this account is known not to be allowed. That leaves only the
 * case of an allow-list holding no module with a page at all - a list of retired
 * keys, or one written directly into the database - which is worth showing as a
 * refusal rather than papering over.
 *
 * Only decides what is drawn, like every other guard here. The backend enforces
 * module access independently.
 */
export default function RequireModuleHome({ children }) {
  const currentAdmin = useSelector(selectCurrentAdmin);

  const target = landingPathFor(currentAdmin);

  if (target === null) {
    return <AccessDenied moduleKey="dashboard" />;
  }

  if (target === '/') {
    return children;
  }

  return <Navigate to={target} replace />;
}
