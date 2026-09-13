import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Button, Result, Space, Typography } from 'antd';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { hasModule } from '@/utils/modulePermissions';
import useLanguage from '@/locale/useLanguage';

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
  // very page we would otherwise offer to send them to. Only show the button
  // when it leads somewhere they are allowed to be. This is not a dead end
  // either way: the sidebar stays mounted around this screen, so any module they
  // do have is one click away.
  const canSeeDashboard = hasModule(currentAdmin, 'dashboard');

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
        canSeeDashboard ? (
          <Button type="primary" onClick={() => navigate('/')}>
            {translate('Back')}
          </Button>
        ) : (
          <Button onClick={() => navigate('/logout')}>Sign out</Button>
        )
      }
    />
  );
}
