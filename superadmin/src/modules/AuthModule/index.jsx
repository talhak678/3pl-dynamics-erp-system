import useLanguage from '@/locale/useLanguage';

import { Layout, Col, Divider, Typography } from 'antd';

import AuthLayout from '@/layout/AuthLayout';
import SideContent from './SideContent';

import lightLogo from '@/style/images/light-logo.png';
import darkLogo from '@/style/images/dark-logo.png';
import { useTheme } from '@/context/ThemeContext';

const { Content } = Layout;
const { Title } = Typography;

const AuthModule = ({ authContent, AUTH_TITLE, isForRegistre = false }) => {
  const translate = useLanguage();
  const { theme } = useTheme();
  // Match desktop SideContent: DARK theme = darkLogo (light colored), LIGHT theme = lightLogo (dark colored)
  const logo = theme === 'dark' ? darkLogo : lightLogo;
  return (
    <AuthLayout sideContent={<SideContent />}>
      <Content
        style={{
          padding: isForRegistre ? '40px 30px 30px' : '100px 30px 30px',
          maxWidth: '440px',
          margin: '0 auto',
        }}
      >
        <Col xs={{ span: 24 }} sm={{ span: 24 }} md={{ span: 0 }} span={0}>
          <img
            src={logo}
            alt="3PL Dynamics"
            style={{
              margin: '0px auto 20px',
              display: 'block',
              maxWidth: '180px',
              width: '60%',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
          <div className="space10" />
        </Col>
        <Title level={1}>{translate(AUTH_TITLE)}</Title>

        <Divider />
        <div className="site-layout-content">{authContent}</div>
      </Content>
    </AuthLayout>
  );
};

export default AuthModule;
