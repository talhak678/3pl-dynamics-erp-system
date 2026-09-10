import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Drawer, Layout, Menu } from 'antd';

import { useAppContext } from '@/context/appContext';

import useLanguage from '@/locale/useLanguage';
import lightLogo from '@/style/images/light-logo.png';
import darkLogo from '@/style/images/dark-logo.png';
import { useTheme } from '@/context/ThemeContext';

import useResponsive from '@/hooks/useResponsive';

import {
  SettingOutlined,
  CustomerServiceOutlined,
  ContainerOutlined,
  FileSyncOutlined,
  DashboardOutlined,
  CreditCardOutlined,
  MenuOutlined,
  ShopOutlined,
  WalletOutlined,
  ReconciliationOutlined,
  UserOutlined,
  FileOutlined,
  FilterOutlined,
  TagOutlined,
  TagsOutlined,
  ShoppingCartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

export default function Navigation() {
  const { isMobile } = useResponsive();

  return isMobile ? <MobileSidebar /> : <Sidebar collapsible={false} />;
}

function Sidebar({ collapsible, isMobile = false }) {
  let location = useLocation();
  const { theme } = useTheme();

  const { state: stateApp, appContextAction } = useAppContext();
  const { isNavMenuClose } = stateApp;
  const { navMenu } = appContextAction;
  const [currentPath, setCurrentPath] = useState(location.pathname.slice(1));

  const translate = useLanguage();
  const navigate = useNavigate();

  const items = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to={'/'}>{translate('dashboard')}</Link>,
    },
    {
      key: 'invoice',
      icon: <ContainerOutlined />,
      label: <Link to={'/invoice'}>{translate('invoices')}</Link>,
    },
    {
      key: 'payment',
      icon: <CreditCardOutlined />,
      label: <Link to={'/payment'}>{translate('payments')}</Link>,
    },
    {
      key: 'quote',
      icon: <FileSyncOutlined />,
      label: <Link to={'/quote'}>{translate('quote')}</Link>,
    },
    {
      key: 'customer',
      icon: <CustomerServiceOutlined />,
      label: <Link to={'/customer'}>{translate('customers')}</Link>,
    },
    {
      key: 'people',
      icon: <UserOutlined />,
      label: <Link to={'/people'}>{translate('peoples')}</Link>,
    },
    {
      key: 'company',
      icon: <ShopOutlined />,
      label: <Link to={'/company'}>{translate('companies')}</Link>,
    },
    {
      key: 'lead',
      icon: <FilterOutlined />,
      label: <Link to={'/lead'}>{translate('leads')}</Link>,
    },
    {
      key: 'offer',
      icon: <FileOutlined />,
      label: <Link to={'/offer'}>{translate('Offers for Leads')}</Link>,
    },
    {
      key: 'product',
      icon: <TagOutlined />,
      label: <Link to={'/product'}>{translate('products')}</Link>,
    },
    {
      key: 'category/product',
      icon: <TagsOutlined />,
      label: <Link to={'/category/product'}>{translate('Products Category')}</Link>,
    },
    {
      key: 'order',
      icon: <ShoppingCartOutlined />,
      label: <Link to={'/order'}>{translate('Order')}</Link>,
    },
    {
      key: 'expenses',
      icon: <WalletOutlined />,
      label: <Link to={'/expenses'}>{translate('expenses')}</Link>,
    },
    {
      key: 'category/expenses',
      icon: <ReconciliationOutlined />,
      label: <Link to={'/category/expenses'}>{translate('Expenses Category')}</Link>,
    },
    {
      key: 'report',
      icon: <PieChartOutlined />,
      label: translate('Report'),
      disabled: true,
    },
    {
      label: translate('Settings'),
      key: 'settingsMenu',
      icon: <SettingOutlined />,
      children: [
        {
          key: 'generalSettings',
          label: <Link to={'/settings'}>{translate('settings')}</Link>,
        },
        // {
        //   key: 'paymentMode',
        //   label: <Link to={'/payment/mode'}>{translate('payments_mode')}</Link>,
        // },
        {
          key: 'taxes',
          label: <Link to={'/taxes'}>{translate('taxes')}</Link>,
        },
        {
          key: 'help',
          label: <Link to={'/help'}>{translate('Help')}</Link>,
        },
      ],
    },
  ];

  useEffect(() => {
    if (location)
      if (currentPath !== location.pathname) {
        if (location.pathname === '/') {
          setCurrentPath('dashboard');
        } else setCurrentPath(location.pathname.slice(1));
      }
  }, [location, currentPath]);

  const onCollapse = () => {
    navMenu.collapse();
  };

  return (
    <Sider
      collapsible={collapsible}
      collapsed={collapsible ? isNavMenuClose : collapsible}
      onCollapse={onCollapse}
      className="navigation"
      width={isMobile ? 250 : 256}
      theme={theme}
    >
      <div
        className="logo"
        onClick={() => navigate('/')}
        style={{
          cursor: 'pointer',
        }}
      >
        {theme === 'dark' ? (
          <img src={darkLogo} alt="3PL Dynamics" className="sidebar-logo" />
        ) : (
          <img src={lightLogo} alt="3PL Dynamics" className="sidebar-logo" />
        )}
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

function MobileSidebar() {
  const [visible, setVisible] = useState(false);
  const onClose = () => {
    setVisible(false);
  };

  return (
    <div className="mobile-navigation-trigger">
      <Button
        type="text"
        size="large"
        onClick={() => setVisible((isVisible) => !isVisible)}
        className="mobile-sidebar-btn"
        style={{ ['marginLeft']: 25 }}
      >
        <MenuOutlined style={{ fontSize: 18 }} />
      </Button>
      <Drawer
        width={250}
        placement="left"
        closable={false}
        onClose={onClose}
        open={visible}
        className="mobile-navigation-drawer"
        styles={{
          body: { padding: 0 },
          content: { overflow: 'hidden' },
        }}
      >
        <Sidebar collapsible={false} isMobile={true} />
      </Drawer>
    </div>
  );
}
