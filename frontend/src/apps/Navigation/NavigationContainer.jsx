import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Button, Drawer, Layout, Menu } from 'antd';

import { useAppContext } from '@/context/appContext';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { resolveModules } from '@/utils/modulePermissions';
import { canUseSalesPipeline } from '@/utils/salesPipeline';

import useLanguage from '@/locale/useLanguage';
import lightLogo from '@/style/images/light-logo.png';
import darkLogo from '@/style/images/dark-logo.png';
import { useTheme } from '@/context/ThemeContext';

import useResponsive from '@/hooks/useResponsive';

import {
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
  FunnelPlotOutlined,
  PercentageOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

/**
 * Not gated by the module allow-list: the navigation entries carrying
 * `ungated: true`.
 *
 * filterByModules drops every item whose key is absent from the granted list.
 * Two entries cannot be expressed as a module key at all:
 *
 *   User Management  a capability of owning the workspace, and deliberately not
 *                    something an owner can grant away.
 *   Sales Pipeline   real, but a second view of the `lead` module rather than a
 *                    module of its own - /api/lead/* is what sits behind it -
 *                    so its key is not in the granted list and never will be.
 *
 * Without this both would vanish from the sidebar of any tenant whose modules
 * are restricted, which is exactly the tenant most likely to be managing
 * employees or working leads.
 *
 * Such an entry is passed through the filter untouched and rebuilt without the
 * marker, so it never reaches the Ant Design Menu. The marker is not what gates
 * it: the entry is only built into `items` at all when its own condition holds,
 * a few lines below. This just stops the module filter from removing it a
 * second time.
 */
const isUngatedEntry = (item) => item.ungated === true;

/** Drops the marker so it never reaches the Ant Design Menu. */
const stripMarker = (item) => {
  // A copy with the key deleted, rather than `({ ungated, ...item }) => item`.
  // The destructure reads better but names a binding it never uses, which
  // no-unused-vars reports - and silence would need ignoreRestSiblings turned
  // on for the whole project, hiding genuine unused variables everywhere else.
  const stripped = { ...item };
  delete stripped.ungated;
  return stripped;
};

/**
 * Narrows the navigation tree to the modules an account has been granted.
 *
 * The "empty or absent list means every module" rule lives in
 * utils/modulePermissions.js, which the route guard reads too — so the menu and
 * the routes can never disagree about who may see what.
 *
 * Every entry is rebuilt without the marker, on both paths, so an unknown prop
 * never reaches rc-menu's item.
 */
const filterByModules = (items, admin) => {
  const granted = resolveModules(admin);

  // Mapped even on this path: an unrestricted account still carries the ungated
  // entries, and letting that marker reach the Menu would spread an unknown
  // prop onto rc-menu's item.
  if (!granted) return items.map(stripMarker);

  return items.reduce((visible, item) => {
    // Not module-gated, so the granted list says nothing about it. Rebuilt
    // without the marker rather than pushed as-is, so the Menu never sees it.
    if (isUngatedEntry(item)) {
      visible.push(stripMarker(item));
      return visible;
    }

    // A container entry - one that renders a disclosure triangle over `children`
    // - is not a module and has no key in the server's MODULE_KEYS, so it can
    // never appear in the allow-list. Matching one on its own key would drop the
    // whole group even for an account granted every module inside it; it has to
    // survive on its children and fall away only once none of them are granted.
    //
    // Nothing in `items` above is shaped that way any more. The Settings group
    // was the last one, and Taxes and Help were promoted out of it to top-level
    // entries. The branch stays because dropping it would not fail loudly: the
    // fall-through below would match a container on its own key, find nothing,
    // and silently delete any nested entry someone adds later for exactly the
    // restricted tenants the filter exists to serve.
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

  // The same predicate the /sales-pipeline route reads, so the menu entry and
  // the route can never disagree about who may open it. It is narrower than
  // "has the lead module": an employee granted `lead` works leads on the Leads
  // page and must not be offered the pipeline.
  const canSeePipeline = canUseSalesPipeline(currentAdmin);

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
    // Sits next to Leads because it is the same records seen another way.
    // Appended here rather than filtered out later, for the same reason as the
    // entry below: an item that was never built is not one devtools inspection
    // away from being a visible one.
    ...(canSeePipeline
      ? [
          {
            // Must match the URL minus its leading slash: the Menu highlights
            // with selectedKeys={[currentPath]}, and currentPath is the
            // pathname sliced at 1.
            key: 'sales-pipeline',
            icon: <FunnelPlotOutlined />,
            label: <Link to={'/sales-pipeline'}>{translate('Sales Pipeline')}</Link>,
            ungated: true,
          },
        ]
      : []),
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
            ungated: true,
          },
        ]
      : []),
    // Taxes and Help used to live inside a "Settings" dropdown, and that group
    // is gone: /settings is reachable from the profile menu in the header, so
    // the sidebar was offering the same page twice while burying two modules of
    // their own behind a disclosure triangle. Both are now top-level entries, in
    // the same place in the list a Leads or Products entry would occupy, and
    // gated the same way - by their own module key, through filterByModules
    // below. Nothing about the permission changed; only the nesting did.
    {
      key: 'taxes',
      icon: <PercentageOutlined />,
      label: <Link to={'/taxes'}>{translate('taxes')}</Link>,
    },
    {
      key: 'help',
      icon: <QuestionCircleOutlined />,
      label: <Link to={'/help'}>{translate('Help')}</Link>,
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
