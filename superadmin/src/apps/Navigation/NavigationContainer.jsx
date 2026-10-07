import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';

import { ApartmentOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';

import useLanguage from '@/locale/useLanguage';
import { useTheme } from '@/context/ThemeContext';

import lightLogo from '@/style/images/light-logo.png';
import darkLogo from '@/style/images/dark-logo.png';

const { Sider } = Layout;

export default function NavigationContainer() {
  const location = useLocation();
  const { theme } = useTheme();
  const translate = useLanguage();

  const [currentPath, setCurrentPath] = useState(
    location.pathname === '/' ? 'dashboard' : location.pathname.slice(1)
  );

  // Exactly three modules. The ERP's 18-item navigation is intentionally absent
  // — a super admin administers accounts, not business data. Workspaces come
  // first because they are the prerequisite for the other two: an account
  // cannot be created until the workspace it belongs to exists.
  const items = [
    {
      key: 'dashboard',
      icon: <TeamOutlined />,
      label: <Link to={'/'}>{translate('Dashboard')}</Link>,
    },
    {
      key: 'workspaces',
      icon: <ApartmentOutlined />,
      label: <Link to={'/workspaces'}>{translate('Workspace Management')}</Link>,
    },
    {
      key: 'create-user',
      icon: <UserAddOutlined />,
      label: <Link to={'/create-user'}>{translate('Create User')}</Link>,
    },
  ];

  useEffect(() => {
    if (location.pathname === '/') {
      setCurrentPath('dashboard');
    } else {
      setCurrentPath(location.pathname.slice(1));
    }
  }, [location]);

  return (
    <Sider collapsible={false} className="navigation" width={256} theme={theme}>
      <div className="logo">
        {/* Matches the ERP convention: dark theme uses the light-coloured mark. */}
        <img
          src={theme === 'dark' ? darkLogo : lightLogo}
          alt="3PL Dynamics"
          className="sidebar-logo"
        />
      </div>
      <Menu
        items={items}
        mode="inline"
        theme={theme}
        selectedKeys={[currentPath]}
        style={{
          width: 256,
        }}
      />
    </Sider>
  );
}
