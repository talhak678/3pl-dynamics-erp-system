import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Button, Result, Space, Typography } from 'antd';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import useLanguage from '@/locale/useLanguage';
import { landingPathFor } from '@/router/moduleHome';

const { Text } = Typography;

/**
 * Rendered by RequireModule in place of a page the account has not been granted.
 *
 * The sentence is written inline rather than passed through useLanguage(): that
 * helper Title-Cases every word of a key it does not know and records it in
 * localStorage['lang'], so a whole sentence would come back mangled as "Your
 * Account Does Not Have Access To This Module".
 */
export default function AccessDenied({ moduleKey = '' }) {
  const translate = useLanguage();
  const navigate = useNavigate();
  const currentAdmin = useSelector(selectCurrentAdmin);

  // The dashboard is a module like any other, so an account can be refused the
  // very page we would otherwise offer to send them to. This is the same
  // question the home route asks, so it is the same answer: the first module
  // this account actually holds, or nothing at all.
  //
  // Null is the genuine dead end - an allow-list with no module that has a page
  // - and only then is signing out the useful offer. The sidebar stays mounted
  // around this screen either way, so any module they do have is one click away.
  const landing = landingPathFor(currentAdmin);

  return (
    <Result
      status="403"
      title="Access denied"
      subTitle={
        <Space direction="vertical" size={2}>
          <span>Your account does not have access to this module.</span>
          {moduleKey ? (
            <Text type="secondary">
              Module: <Text code>{moduleKey}</Text>
            </Text>
          ) : null}
          <Text type="secondary">Ask your administrator to enable it for you.</Text>
        </Space>
      }
      extra={
        landing ? (
          <Button type="primary" onClick={() => navigate(landing)}>
            {translate('Back')}
          </Button>
        ) : (
          <Button onClick={() => navigate('/logout')}>Sign out</Button>
        )
      }
    />
  );
}
