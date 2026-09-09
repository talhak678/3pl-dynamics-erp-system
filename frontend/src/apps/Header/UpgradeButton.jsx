import { Button, Badge } from 'antd';

// import Notifications from '@/components/Notification';

import { RocketOutlined } from '@ant-design/icons';

import useLanguage from '@/locale/useLanguage';

export default function UpgradeButton() {
  const translate = useLanguage();

  return (
    <Badge count={1} size="small">
      <Button
        type="primary"
        style={{
          float: 'right',
          marginTop: '5px',
          cursor: 'pointer',
          background: 'var(--color-button)',
          boxShadow: 'var(--app-shadow)',
        }}
        icon={<RocketOutlined />}
        onClick={() => {
          window.open(`https://www.3pldynamicsai.com`);
        }}
      >
        {translate('Try Entreprise Version')}
      </Button>
    </Badge>
  );
}
