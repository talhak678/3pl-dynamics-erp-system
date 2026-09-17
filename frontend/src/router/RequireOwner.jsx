import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Button, Result, Space, Typography } from 'antd';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { hasModule } from '@/utils/modulePermissions';
import useLanguage from '@/locale/useLanguage';

const { Text } = Typography;

/**
 * Route guard for pages only the account that owns the workspace may open.
 *
 * The sibling of RequireModule, and it exists separately because the question
 * is different. RequireModule asks "has this account been granted module X?" -
 * a grant an administrator can hand out. This asks "does this account own the
 * workspace?", which is not grantable at all: an employee must never reach User
 * Management, and there is no module key that could express that, because a
 * module key is something an owner could then tick for them.
 *
 * Like RequireModule this only decides what the user sees. The enforcement is
 * requireTenantOwner on the backend, which re-derives the role from the token -
 * typing this URL is refused by the server whether or not this component runs.
 */
export default function RequireOwner({ children }) {
  const translate = useLanguage();
  const navigate = useNavigate();
  const currentAdmin = useSelector(selectCurrentAdmin);

  const isOwner = currentAdmin?.role === 'owner' && currentAdmin?.isSuperAdmin !== true;

  if (!isOwner) {
    return (
      <Result
        status="403"
        title="Access denied"
        subTitle={
          <Space direction="vertical" size={2}>
            {/* Written inline rather than through useLanguage(): that helper
                Title-Cases any key it does not know, which mangles a whole
                sentence. */}
            <span>Only the account that owns this workspace can manage its users.</span>
            <Text type="secondary">
              Ask the account owner if you need a user added or changed.
            </Text>
          </Space>
        }
        extra={
          hasModule(currentAdmin, 'dashboard') ? (
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

  return children;
}
