import { Space, Layout, Divider, Typography } from 'antd';
import lightLogo from '@/style/images/light-logo.png';
import darkLogo from '@/style/images/dark-logo.png';
import useLanguage from '@/locale/useLanguage';
import { useTheme } from '@/context/ThemeContext';

const { Content } = Layout;
const { Title, Text } = Typography;

export default function SideContent() {
  const translate = useLanguage();
  const { theme } = useTheme();
  // DARK theme = LIGHT logo (light-colored for dark bg)
  // LIGHT theme = DARK logo (dark-colored for light bg)
  const logo = theme === 'dark' ? darkLogo : lightLogo;

  return (
    <Content
      style={{
        padding: '150px 30px 30px',
        width: '100%',
        maxWidth: '400px',
        margin: '0 auto',
      }}
      className="sideContent"
    >
      <div style={{ width: '100%' }}>
        <img
          src={logo}
          alt="3PL Dynamics ERP CRM"
          style={{
            margin: '0 auto 40px',
            display: 'block',
            maxWidth: '250px',
            width: '80%',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
        <div className="space40"></div>
        <Title level={3} style={{ whiteSpace: 'nowrap' }}>
          {translate('Manage your company with')} :
        </Title>

        <div className="space20"></div>
        <ul className="list-checked" style={{ paddingRight: 0 }}>
          <li className="list-checked-item list-checked-item-left">
            <Space direction="vertical">
              <Text strong>{translate('All In One Tool')}</Text>
              <Text>{translate('Run and scale your ERP CRM Apps')}</Text>
            </Space>
          </li>

          <li className="list-checked-item list-checked-item-left">
            <Space direction="vertical">
              <Text strong>{translate('Easily add and manage your services')}</Text>
              <Text>{translate('It brings together your invoice clients and leads')}</Text>
            </Space>
          </li>
        </ul>
        <Divider />
      </div>
    </Content>
  );
}
