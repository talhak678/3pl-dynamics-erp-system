import { Routes, Route, Navigate } from 'react-router-dom';

import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import ForgetPassword from '@/pages/ForgetPassword';
import ResetPassword from '@/pages/ResetPassword';

// The password-reset pair is public on the API and needs no session, so both
// screens live here alongside sign-in rather than behind the protected router.
// The link in the email lands on /resetpassword/:token, which is why the route
// carries the token as a path parameter.
export default function AuthRouter() {
  return (
    <Routes>
      <Route element={<Login />} path="/" />
      <Route element={<Login />} path="/login" />
      <Route element={<Navigate to="/login" replace />} path="/logout" />
      <Route element={<ForgetPassword />} path="/forgetpassword" />
      <Route element={<ResetPassword />} path="/resetpassword/:token" />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
