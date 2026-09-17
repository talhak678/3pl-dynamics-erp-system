import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Button, Drawer, Layout, Menu } from 'antd';

import { useAppContext } from '@/context/appContext';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { resolveModules } from '@/utils/modulePermissions';

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
  TeamOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

/**
 * Not gated by a module: the navigation entries carrying `ownerOnly: true`.
 *
 * filterByModules drops every item whose key is absent from the granted list.
 * User Management has no module key and never will - it is a capability of
 * owning the workspace, not something an owner can grant - so without this it
 * would vanish from the sidebar of any tenant whose modules are restricted,
 * which is exactly the tenant most likely to be managing employees.
 *
 * Such an entry is passed through the filter untouched and rebuilt without the
 * marker, so it never reaches the Ant Design Menu.
 */
const isOwnerOnlyEntry = (item) => item.ownerOnly === true;

/** Drops the marker so it never reaches the Ant Design Menu. */
const stripMarker = ({ ownerOnly, ...item }) => item;

/**
 * Narrows the navigation tree to the modules an account has been granted.
 *
 * The "empty or absent list means every module" rule lives in
 * utils/modulePermissions.js, which the route guard reads too — so the menu and
 * the routes can never disagree about who may see what.
 *
 * Returns the array untouched when the account is unrestricted, so the common
 * case allocates nothing.
 */
const filterByModules = (items, admin) => {
  const granted = resolveModules(admin);

  // Mapped even on this path: an unrestricted account still carries the
  // owner-only entry, and letting its marker reach the Menu would spread an
  // unknown prop onto rc-menu's item.
  if (!granted) return items.map(stripMarker);

  return items.reduce((visible, item) => {
    // Not module-gated, so the granted list says nothing about it. Rebuilt
    // without the marker rather than pushed as-is, so the Menu never sees it.
    if (isOwnerOnlyEntry(item)) {
      visible.push(stripMarker(item));
      return visible;
    }

    // 'settingsMenu' is a container, not a module, so it has no entry in the
    // server's MODULE_KEYS and can never appear in the allow-list. Matching it
    // on its own key would drop the whole Settings group even for an account
    // granted generalSettings, taxes or help. It survives on its children and
    // falls away only once none of them are granted.
    if (Array.isArray(item.children)) {
      const children = item.children.filter((child) => granted.includes(child.key));
      if (children.length > 0) visible.push({ ...item, children });
      return visible;
    }

    if (granted.includes(item.key)) visible.push(item);
    return visible;
  }, []);
};

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
  const currentAdmin = useSelector(selectCurrentAdmin);

  // Ownership, not a module grant. `isSuperAdmin` is excluded explicitly: a
  // super admin owns no workspace, so there is no team for them to manage, and
  // the backend gate refuses them for the same reason.
  const isOwner = currentAdmin?.role === 'owner' && currentAdmin?.isSuperAdmin !== true;

  const items = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to={'/'}>{translate('Dashboard & Reports')}</Link>,
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
    // Only the account that owns the workspace sees this, and employees never
    // do. Appended conditionally rather than filtered out afterwards, so the
    // entry does not exist at all for an employee - a hidden menu item is one
    // devtools inspection away from being a visible one.
    ...(isOwner
      ? [
          {
            // Must match the URL minus its leading slash: the Menu highlights
            // with selectedKeys={[currentPath]}, and currentPath is the
            // pathname sliced at 1. 'category/product' works the same way.
            key: 'user-management',
            icon: <TeamOutlined />,
            label: <Link to={'/user-management'}>{translate('User Management')}</Link>,
            ownerOnly: true,
          },
        ]
      : []),
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

  const visibleItems = filterByModules(items, currentAdmin);

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
        items={visibleItems}
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
