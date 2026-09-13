import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';

import NavigationContainer from '@/apps/Navigation/NavigationContainer';
import HeaderContainer from '@/apps/Header/HeaderContainer';

const { Content } = Layout;

export default function SuperAdminLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <NavigationContainer />
      <Layout>
        <HeaderContainer />
        <Content
          style={{
            padding: '24px',
            background: 'var(--app-bg)',
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: '0 auto',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
