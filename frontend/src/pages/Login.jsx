import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import useLanguage from '@/locale/useLanguage';

import { Alert, Form, Button } from 'antd';

import { login } from '@/redux/auth/actions';
import { selectAuth } from '@/redux/auth/selectors';
import { SESSION_ENDED_KEY } from '@/request/errorHandler';
import LoginForm from '@/forms/LoginForm';
import Loading from '@/components/Loading';
import AuthModule from '@/modules/AuthModule';

const LoginPage = () => {
  const translate = useLanguage();
  const { isLoading, isSuccess } = useSelector(selectAuth);
  const navigate = useNavigate();
  // const size = useSize();

  const dispatch = useDispatch();
  const onFinish = (values) => {
    dispatch(login({ loginData: values }));
  };

  // A session that ended server-side — a suspended account, most often — is
  // signed out with a full page reload, which is what makes it impossible to
  // show a toast at the time. errorHandler leaves the reason in sessionStorage
  // instead and we surface it here.
  //
  // Read once and cleared straight away, so a student refreshing the sign-in
  // page later is not told about something that happened hours ago.
  const [signOutReason, setSignOutReason] = useState('');

  useEffect(() => {
    let reason = '';
    try {
      reason = window.sessionStorage.getItem(SESSION_ENDED_KEY) || '';
      if (reason) window.sessionStorage.removeItem(SESSION_ENDED_KEY);
    } catch (error) {
      // Storage unavailable. Not worth failing the sign-in form over.
      console.error('Could not read the sign-out reason:', error);
    }
    if (reason) setSignOutReason(reason);
  }, []);

  useEffect(() => {
    if (isSuccess) navigate('/');
  }, [isSuccess]);

  const FormContainer = () => {
    return (
      <Loading isLoading={isLoading}>
        {signOutReason ? (
          <Alert type="warning" showIcon message={signOutReason} style={{ marginBottom: 16 }} />
        ) : null}
        <Form
          layout="vertical"
          name="normal_login"
          className="login-form"
          initialValues={{
            remember: true,
          }}
          onFinish={onFinish}
        >
          <LoginForm />
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="login-form-button"
              loading={isLoading}
              size="large"
            >
              {translate('Log in')}
            </Button>
          </Form.Item>
        </Form>
      </Loading>
    );
  };

  return <AuthModule authContent={<FormContainer />} AUTH_TITLE="Sign in" />;
};

export default LoginPage;
