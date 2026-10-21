import { Link, useNavigate } from 'react-router-dom';

import { Form, Result, Button } from 'antd';
import useOnFetch from '@/hooks/useOnFetch';
import { forgetPassword } from '@/auth';

import ForgetPasswordForm from '@/forms/ForgetPasswordForm';

import Loading from '@/components/Loading';
import AuthModule from '@/modules/AuthModule';

const ForgetPassword = () => {
  const navigate = useNavigate();

  const { onFetch, isSuccess, isLoading } = useOnFetch();

  // `portal` is what lets the API choose the right deployment for the link in
  // the email. The server maps it to its own FRONTEND_URL; nothing in this
  // request can point the link somewhere else.
  const requestReset = (values) => forgetPassword({ email: values.email, portal: 'frontend' });

  const onFinish = (values) => {
    onFetch(requestReset(values));
  };

  const FormContainer = () => {
    return (
      <Loading isLoading={isLoading}>
        <Form name="forget_password" className="login-form" onFinish={onFinish}>
          <ForgetPasswordForm />
          <Form.Item>
            <Button type="primary" htmlType="submit" className="login-form-button" size="large">
              Send reset link
            </Button>
            <Link to="/login">Back to login</Link>
          </Form.Item>
        </Form>
      </Loading>
    );
  };

  if (!isSuccess) {
    return <AuthModule authContent={<FormContainer />} AUTH_TITLE="Forgot Password" />;
  }

  return (
    <AuthModule
      AUTH_TITLE="Check your email"
      authContent={
        <Result
          status="success"
          title="Password reset email sent"
          subTitle="If an account exists for that email, a reset link is on its way. The link expires shortly and can be used once."
          extra={
            <Button
              type="primary"
              onClick={() => {
                navigate(`/login`);
              }}
            >
              Back to login
            </Button>
          }
        />
      }
    />
  );
};

export default ForgetPassword;
