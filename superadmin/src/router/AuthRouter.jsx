import { Routes, Route, Navigate } from 'react-router-dom';

import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';

// Only the login screen lives here. There is deliberately no forget/reset
// password flow: super admin credentials are provisioned out of band, matching
// how the ERP gates its own admin accounts.
export default function AuthRouter() {
  return (
    <Routes>
      <Route element={<Login />} path="/" />
      <Route element={<Login />} path="/login" />
      <Route element={<Navigate to="/login" replace />} path="/logout" />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
