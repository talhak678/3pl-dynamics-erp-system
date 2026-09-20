import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Button, Result, Space, Typography } from 'antd';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { hasModule } from '@/utils/modulePermissions';
import { SALES_PIPELINE_MODULE, isPipelineRole } from '@/utils/salesPipeline';
import AccessDenied from '@/components/AccessDenied';
import useLanguage from '@/locale/useLanguage';

const { Text } = Typography;

/**
 * Route guard for the Sales Pipeline.
 *
 * Two questions, checked in the order that gives the more useful answer. The
 * first is the role - "is this account an owner or a Sales Executive?" - which
 * is a job title and cannot be granted. The second is the `lead` module, which
 * can. Asking about the module first would tell a Marketing employee with the
 * leads module that their account "does not have access to this module", which
 * is misleading: they hold it, and the reason they cannot be here is their
 * role.
 *
 * A missing module then falls through to AccessDenied, the same screen every
 * other module route shows, rather than a second bespoke refusal.
 *
 * Like RequireModule and RequireOwner this only decides what is drawn. The
 * enforcement is on the server: requireModuleAccess resolves /api/lead/* to the
 * `lead` module, and ownership.js narrows the rows by role. Typing this URL
 * changes nothing about what the API will return.
 */
export default function RequireSalesPipeline({ children }) {
  const translate = useLanguage();
  const navigate = useNavigate();
  const currentAdmin = useSelector(selectCurrentAdmin);

  if (!isPipelineRole(currentAdmin)) {
    return (
      <Result
        status="403"
        title="Access denied"
        subTitle={
          <Space direction="vertical" size={2}>
            {/* Written inline rather than through useLanguage(): that helper
                Title-Cases any key it does not know, which would mangle a whole
                sentence. */}
            <span>The Sales Pipeline is for the workspace owner and its sales executives.</span>
            <Text type="secondary">
              Ask the account owner if you need access to it.
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

  if (!hasModule(currentAdmin, SALES_PIPELINE_MODULE)) {
    return <AccessDenied moduleKey={SALES_PIPELINE_MODULE} />;
  }

  return children;
}
