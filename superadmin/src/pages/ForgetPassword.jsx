import { useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { Alert, Button, Form, Result } from 'antd';

import { forgetPassword } from '@/auth';

import ForgetPasswordForm from '@/forms/ForgetPasswordForm';

import Loading from '@/components/Loading';
import AuthModule from '@/modules/AuthModule';

const ForgetPassword = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onFinish = async (values) => {
    setIsLoading(true);
    setErrorMessage('');

    // The portal is fixed here. It is what makes the emailed link return to the
    // Super Admin deployment instead of the Customer Portal.
    const data = await forgetPassword({ email: values.email, portal: 'superadmin' });

    setIsLoading(false);

    if (data && data.success === true) {
      setIsSuccess(true);
      return;
    }

    setErrorMessage(
      data?.message || 'We could not send the reset email. Please try again later.'
    );
  };

  if (isSuccess) {
    return (
      <AuthModule
        AUTH_TITLE="Check your email"
        authContent={
          <Result
            status="success"
            title="Password reset email sent"
            subTitle="If an account exists for that email, a reset link is on its way. The link expires shortly and can be used once."
            extra={
              <Button type="primary" onClick={() => navigate('/login')}>
                Back to login
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
        <Alert
          type="info"
          showIcon
          message="Super Admin accounts only"
          description="Enter the email registered to a Super Admin account. Reset links issued here return to this portal."
          style={{ marginBottom: 20 }}
        />
        {errorMessage ? (
          <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />
        ) : null}
        <Form
          layout="vertical"
          name="superadmin_forget_password"
          className="login-form"
          onFinish={onFinish}
        >
          <ForgetPasswordForm />
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="login-form-button"
              size="large"
              loading={isLoading}
            >
              Send reset link
            </Button>
            <Link to="/login">Back to login</Link>
          </Form.Item>
        </Form>
      </Loading>
    );
  };

  return <AuthModule authContent={<FormContainer />} AUTH_TITLE="Forgot Password" />;
};

export default ForgetPassword;
