import { useState } from 'react';

import { Link, useParams } from 'react-router-dom';

import { Alert, Button, Form, Result } from 'antd';

import { resetPassword as resetPasswordRequest } from '@/auth';

import ResetPasswordForm from '@/forms/ResetPasswordForm';

import Loading from '@/components/Loading';
import AuthModule from '@/modules/AuthModule';

/**
 * Drops the locally stored session after a successful reset.
 *
 * The server clears loggedSessions when the password changes, so every token
 * this browser is holding is already dead. Removing the persisted copy means a
 * reload or a later visit starts signed out instead of booting the portal with
 * a token the API will reject on its first call.
 */
const clearLocalSession = () => {
  try {
    window.localStorage.removeItem('auth');
    window.localStorage.removeItem('settings');
  } catch (error) {
    console.error('Could not clear the local session:', error);
  }
};

const ResetPassword = () => {
  const { token } = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onFinish = async (values) => {
    setIsLoading(true);
    setErrorMessage('');

    const data = await resetPasswordRequest({
      resetPasswordData: { token, password: values.password },
    });

    setIsLoading(false);

    if (data && data.success === true) {
      clearLocalSession();
      setIsSuccess(true);
      return;
    }

    setErrorMessage(
      data?.message || 'We could not reset your password. Please request a new link.'
    );
  };

  if (isSuccess) {
    return (
      <AuthModule
        AUTH_TITLE="Password updated"
        authContent={
          <Result
            status="success"
            title="Your password has been updated"
            subTitle="You can now sign in to the Super Admin portal with your new password."
            extra={
              // A full reload, not a router navigation. Redux still holds the
              // session it booted with; reloading is what re-reads the cleared
              // storage and mounts the sign-in screen.
              <Button type="primary" onClick={() => window.location.assign('/login')}>
                Sign in
              </Button>
            }
          />
        }
      />
    );
  }

  const FormContainer = () => {
    return (
      <Loading isLoading={isLoading}>
        {errorMessage ? (
          <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />
        ) : null}
        <Form
          layout="vertical"
          name="superadmin_reset_password"
          className="login-form"
          onFinish={onFinish}
        >
          <ResetPasswordForm />
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="login-form-button"
              size="large"
              loading={isLoading}
            >
              Update password
            </Button>
            <Link to="/login">Back to login</Link>
          </Form.Item>
        </Form>
      </Loading>
    );
  };

  return <AuthModule authContent={<FormContainer />} AUTH_TITLE="Reset Password" />;
};

export default ResetPassword;
