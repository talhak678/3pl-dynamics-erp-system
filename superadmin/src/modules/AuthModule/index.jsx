import useLanguage from '@/locale/useLanguage';

import { Typography } from 'antd';

import AuthLayout from '@/layout/AuthLayout';

import lightLogo from '@/style/images/light-logo.png';
import darkLogo from '@/style/images/dark-logo.png';
import { useTheme } from '@/context/ThemeContext';

/* The sign-in card that sits on the rotating photograph from AuthLayout.
   Mirrors 3PL-Dynamics-FontEnd / src/components/auth/SignInForm.tsx:
   logo, heading, then the form, all inside one glass panel.

   The original centred-column markup is commented out at the bottom of this
   file, along with the imports it needed, so it can be restored.

   `isForRegistre` was dropped from the props: nothing has passed it since the
   register page was removed, and it only chose between two top paddings that
   the centring layout no longer uses. */
const { Title } = Typography;

const AuthModule = ({ authContent, AUTH_TITLE }) => {
  const translate = useLanguage();
  const { theme } = useTheme();
  // DARK theme = darkLogo (light coloured), LIGHT theme = lightLogo (dark coloured)
  const logo = theme === 'dark' ? darkLogo : lightLogo;

  return (
    <AuthLayout>
      <div className="auth-glass-card">
        {/* Outside the commented-out block below: the logo used to be hidden on
            desktop because the left-hand panel carried it. With that panel gone
            the card is the only place left for it. */}
        <img className="auth-card-logo" src={logo} alt="3PL Dynamics" />

        <Title level={1} className="auth-card-title">
          {translate(AUTH_TITLE)}
        </Title>

        <div className="site-layout-content">{authContent}</div>
      </div>

      {/*
        ---- ORIGINAL LAYOUT - commented out, not deleted ----

        Restoring this also means restoring the two imports it needs - see the
        commented-out lines at the top and bottom of this file - and the
        `sideContent` prop in layout/AuthLayout.

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
      */}
    </AuthLayout>
  );
};

// import { Layout, Col, Divider, Typography } from 'antd'; // Layout/Col/Divider only served the block above
// import SideContent from './SideContent';                 // the left-hand panel, passed to AuthLayout as `sideContent`
// const { Content } = Layout;

export default AuthModule;
