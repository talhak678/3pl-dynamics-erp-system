import { useSelector } from 'react-redux';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { hasModule } from '@/utils/modulePermissions';
import AccessDenied from '@/components/AccessDenied';

/**
 * Route guard for the ERP pages.
 *
 * Wraps a page element in routes.jsx and renders the Access Denied screen
 * instead of it when the signed-in account has not been granted `module`. This
 * is what turns a typed URL into a clean refusal rather than a page shell whose
 * data calls all come back 403 from the backend guard.
 *
 * Note that the refused page is not merely hidden — it is never rendered, so a
 * lazy() route's chunk is never even fetched. A denied module costs the tenant
 * no download.
 *
 * The backend guard in middlewares/requireModuleAccess.js is the part that
 * actually enforces access; this component only decides what the tenant sees.
 * Neither is sufficient alone.
 */
export default function RequireModule({ module, children }) {
  const currentAdmin = useSelector(selectCurrentAdmin);

  if (!hasModule(currentAdmin, module)) {
    return <AccessDenied moduleKey={module} />;
  }

  return children;
}
