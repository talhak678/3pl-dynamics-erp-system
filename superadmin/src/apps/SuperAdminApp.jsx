import { Routes, Route, Navigate } from 'react-router-dom';

import SuperAdminLayout from '@/layout/SuperAdminLayout';
import Dashboard from '@/pages/Dashboard';
import WorkspaceManagement from '@/pages/Workspace';
import CreateUser from '@/pages/CreateUser';
import Logout from '@/pages/Logout';
import NotFound from '@/pages/NotFound';

// Plain <Routes> rather than the ERP's routes-object + useRoutes machinery: that
// indirection exists to drive multi-app navigation state the portal has no use
// for. The 404 sits inside the layout so the shell stays visible.
export default function SuperAdminApp() {
  return (
    <Routes>
      <Route element={<SuperAdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="workspaces" element={<WorkspaceManagement />} />
        <Route path="create-user" element={<CreateUser />} />
        <Route path="logout" element={<Logout />} />
        {/* /login belongs to AuthRouter, but this tree can be mounted while the
            URL is /login, and then `*` below renders the 404 inside the shell.
            Two ways it happened: a logout that failed restored the session and
            left the URL where the redirect had already put it, and a successful
            login flips isLoggedIn in the same dispatch that unmounts the login
            page, so its navigate('/') effect never got to run. Redirecting makes
            /login a non-destination while signed in instead of a dead end. */}
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
