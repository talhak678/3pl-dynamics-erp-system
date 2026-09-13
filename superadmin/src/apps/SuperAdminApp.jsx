import { Routes, Route } from 'react-router-dom';

import SuperAdminLayout from '@/layout/SuperAdminLayout';
import Dashboard from '@/pages/Dashboard';
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
        <Route path="create-user" element={<CreateUser />} />
        <Route path="logout" element={<Logout />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
