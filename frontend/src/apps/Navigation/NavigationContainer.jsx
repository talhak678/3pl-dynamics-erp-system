import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Button, Drawer, Layout, Menu } from 'antd';

import { useAppContext } from '@/context/appContext';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { resolveModules } from '@/utils/modulePermissions';
import { canUseSalesPipeline } from '@/utils/salesPipeline';

import lightLogo from '@/style/images/light-logo.png';
import darkLogo from '@/style/images/dark-logo.png';
import { useTheme } from '@/context/ThemeContext';

import useResponsive from '@/hooks/useResponsive';

import {
  AimOutlined,
  AppstoreOutlined,
  BankOutlined,
  ClockCircleOutlined,
  ContainerOutlined,
  CreditCardOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  FileOutlined,
  FileSyncOutlined,
  FilterOutlined,
  FunnelPlotOutlined,
  GlobalOutlined,
  LineChartOutlined,
  MenuOutlined,
  ReconciliationOutlined,
  RiseOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TagOutlined,
  TagsOutlined,
  TeamOutlined,
  ToolOutlined,
  TruckOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  WalletOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

/**
 * The sidebar is ten collapsible parent modules, not a flat list.
 *
 * A parent is a RENDERING hierarchy, not a permission. It has no key of its own
 * and cannot be granted; it is drawn while at least one of its children is
 * held. The `module` property on a child is the grantable key from the server's
 * MODULE_KEYS - it is separate from `key` because a few modules have a
 * hyphenated URL that is not their permission key (`sales-follow-ups` vs
 * `sales_followups`), and because the key is what `selectedKeys` matches.
 *
 * Placeholders are entries with no implementation. They are marked
 * `placeholder: true`, rendered disabled, and carry a small "Soon" marker. A
 * disabled Ant Design menu item is inert - no route change, no 404, no reload -
 * which is exactly the requirement; the marker is what keeps it from reading as
 * a broken link.
 *
 * Labels are plain strings. `translate()` only title-cases and does not read the
 * locale files, so wrapping these would add indirection without adding a
 * translation.
 */

/** A working entry: it links somewhere and is gated by `module`. */
const navItem = (module, path, label, icon) => ({
  key: path.replace(/^\//, '') || 'dashboard',
  module,
  icon,
  label: <Link to={path}>{label}</Link>,
});

/** A not-yet-built entry. Disabled, so Ant Design makes it inert. */
const placeholderItem = (key, label) => ({
  key,
  placeholder: true,
  disabled: true,
  icon: <ClockCircleOutlined />,
  label: (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        // The disabled state already mutes the row; this keeps the marker a
        // shade quieter than the label so it does not read as a status badge.
        opacity: 0.85,
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 10, letterSpacing: 0.3, opacity: 0.7 }}>SOON</span>
    </span>
  ),
});

const isUngatedEntry = (item) => item.ungated === true;

/**
 * Drops the navigation-only markers so they never reach the Ant Design Menu.
 *
 * `disabled` is deliberately kept: Ant Design understands it, and it is what
 * makes a placeholder inert.
 */
const stripMarker = (item) => {
  const stripped = { ...item };
  delete stripped.ungated;
  delete stripped.placeholder;
  delete stripped.module;
  return stripped;
};

const groupHasVisibleActiveChild = (children) => children.some((child) => !child.placeholder);

const onlyPlaceholders = (children) =>
  children.length > 0 && children.every((child) => child.placeholder);

/**
 * Narrows the ten groups to the modules an account has been granted.
 *
 * Rules, in the order they matter:
 *
 *   - An ungated child (Sales Pipeline, User Management) is not a grantable
 *     module. It was only built into the tree when its own role condition held,
 *     so it is always kept. See the comments where each is appended.
 *   - A placeholder is kept with its parent. Placeholders have no permission
 *     key, and hiding the roadmap of a module the account does hold would make
 *     the parent look emptier than the product's own structure.
 *   - A parent is shown when at least one ACTIVE child is granted, or when the
 *     parent has no active children at all (Purchase & Suppliers, POS,
 *     Operations, Website & E-Commerce). Those four exist only as roadmaps, so
 *     "no granted child" cannot hide them - and hiding them from restricted
 *     tenants would make the ten-module structure look like six.
 *   - A parent whose active children were all withheld is dropped, because a
 *     dropdown containing nothing but "Soon" entries describes work the account
 *     cannot do.
 *
 * The "empty or absent list means every module" rule lives in
 * utils/modulePermissions.js, which the route guard reads too - so the menu and
 * the routes can never disagree about who may see what.
 */
const filterByModules = (groups, admin) => {
  const granted = resolveModules(admin);

  if (!granted) {
    return groups.map((group) => ({
      ...group,
      children: group.children.map(stripMarker),
    }));
  }

  return groups.reduce((visible, group) => {
    const children = group.children ?? [];

    const kept = children.filter((child) => {
      if (child.placeholder) return true;
      if (isUngatedEntry(child)) return true;
      return granted.includes(child.module ?? child.key);
    });

    // `children`, not `kept`: a group whose active children were all withheld
    // must be dropped even though its placeholders survived the filter.
    if (groupHasVisibleActiveChild(kept) || onlyPlaceholders(children)) {
      visible.push({ ...group, children: kept.map(stripMarker) });
    }

    return visible;
  }, []);
};

/**
 * Which menu entry a URL belongs to.
 *
 * Longest match wins, so `/category/product` beats `/category`, and a detail
 * route such as `/invoice/read/123` still highlights Invoices rather than
 * matching nothing. The fallback is the path itself, which simply highlights
 * nothing - the same outcome as before this existed.
 */
const SELECTABLE_PATHS = [
  'dashboard',
  'invoice',
  'quote',
  'payment',
  'customer',
  'people',
  'company',
  'lead',
  'sales-pipeline',
  'offer',
  'product',
  'category/product',
  'order',
  'expenses',
  'category/expenses',
  'sales-follow-ups',
  'sales-targets',
  'sales-forecasting',
  'user-management',
  // `/settings/edit/:key` is the Settings editor; without this the page
  // highlights nothing and Administration & Settings never auto-opens.
  'settings',
];

const selectedKeyFor = (pathname) => {
  const path = String(pathname || '').replace(/^\//, '');

  if (path === '') return 'dashboard';

  const match = SELECTABLE_PATHS.filter(
    (candidate) => path === candidate || path.startsWith(`${candidate}/`)
  ).sort((a, b) => b.length - a.length)[0];

  return match ?? path;
};

const parentKeyFor = (groups, selectedKey) =>
  groups.find((group) => group.children?.some((child) => child.key === selectedKey))?.key;

export default function Navigation() {
  const { isMobile } = useResponsive();

  return isMobile ? <MobileSidebar /> : <Sidebar collapsible={false} />;
}

function Sidebar({ collapsible, isMobile = false }) {
  const location = useLocation();
  const { theme } = useTheme();

  const { state: stateApp, appContextAction } = useAppContext();
  const { isNavMenuClose } = stateApp;
  const { navMenu } = appContextAction;

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

  const selectedKey = selectedKeyFor(location.pathname);

  /*
   * The ten parents, in the CEO's order. Conditional entries are appended in
   * place rather than filtered out later, because an item that was never built
   * is never one devtools inspection away from being a visible one.
   */
  const groups = useMemo(
    () => [
      {
        key: 'group-dashboard-reports',
        icon: <DashboardOutlined />,
        label: 'Dashboard & Reports',
        children: [
          navItem('dashboard', '/', 'Dashboard', <DashboardOutlined />),
          placeholderItem('placeholder:reports', 'Reports'),
        ],
      },
      {
        key: 'group-sales-crm',
        icon: <RiseOutlined />,
        label: 'Sales & CRM',
        children: [
          navItem('customer', '/customer', 'Customers', <CustomerServiceOutlined />),
          navItem('lead', '/lead', 'Leads', <FilterOutlined />),
          ...(canSeePipeline
            ? [
                {
                  key: 'sales-pipeline',
                  icon: <FunnelPlotOutlined />,
                  label: <Link to="/sales-pipeline">Sales Pipeline</Link>,
                  // A second view of the `lead` module, so its key is not in the
                  // granted list and never will be. Built only when the role
                  // predicate holds.
                  ungated: true,
                },
              ]
            : []),
          navItem('quote', '/quote', 'Quotes', <FileSyncOutlined />),
          navItem('offer', '/offer', 'Offers for Leads', <FileOutlined />),
          navItem('order', '/order', 'Orders', <ShoppingCartOutlined />),
          navItem('sales_followups', '/sales-follow-ups', 'Sales Follow-ups', <ScheduleOutlined />),
          navItem('sales_targets', '/sales-targets', 'Sales Targets', <AimOutlined />),
          navItem('sales_forecasting', '/sales-forecasting', 'Sales Forecasting', <LineChartOutlined />),
        ],
      },
      {
        key: 'group-accounting-finance',
        icon: <BankOutlined />,
        label: 'Accounting & Finance',
        children: [
          navItem('invoice', '/invoice', 'Invoices', <ContainerOutlined />),
          navItem('payment', '/payment', 'Payments', <CreditCardOutlined />),
          navItem('expenses', '/expenses', 'Expenses', <WalletOutlined />),
          navItem('category/expenses', '/category/expenses', 'Expense Categories', <ReconciliationOutlined />),
          placeholderItem('placeholder:chart_of_accounts', 'Chart of Accounts'),
          placeholderItem('placeholder:vouchers', 'Vouchers'),
          placeholderItem('placeholder:ledger', 'Ledger'),
          placeholderItem('placeholder:customer_supplier_balances', 'Customer / Supplier Balances'),
          placeholderItem('placeholder:financial_statements', 'Financial Statements'),
        ],
      },
      {
        key: 'group-products-inventory',
        icon: <AppstoreOutlined />,
        label: 'Products & Inventory',
        children: [
          navItem('product', '/product', 'Products', <TagOutlined />),
          navItem('category/product', '/category/product', 'Product Categories', <TagsOutlined />),
          placeholderItem('placeholder:stock_tracking', 'Stock Tracking'),
          placeholderItem('placeholder:warehouses', 'Warehouses'),
          placeholderItem('placeholder:stock_adjustments', 'Stock Adjustments'),
          placeholderItem('placeholder:stock_transfers', 'Stock Transfers'),
        ],
      },
      {
        key: 'group-purchase-suppliers',
        icon: <TruckOutlined />,
        label: 'Purchase & Suppliers',
        children: [
          placeholderItem('placeholder:suppliers', 'Suppliers'),
          placeholderItem('placeholder:purchase_orders', 'Purchase Orders'),
          placeholderItem('placeholder:goods_received', 'Goods Received'),
          placeholderItem('placeholder:supplier_bills', 'Supplier Bills'),
        ],
      },
      {
        key: 'group-pos',
        icon: <ShoppingOutlined />,
        label: 'POS (Point of Sale)',
        children: [
          placeholderItem('placeholder:pos_billing', 'POS Billing'),
          placeholderItem('placeholder:pos_sales_transactions', 'Sales Transactions'),
          placeholderItem('placeholder:pos_payment_processing', 'Payment Processing'),
          placeholderItem('placeholder:pos_receipt_generation', 'Receipt Generation'),
          placeholderItem('placeholder:pos_inventory_sync', 'POS Inventory Synchronization'),
        ],
      },
      {
        key: 'group-hr-payroll',
        icon: <UsergroupAddOutlined />,
        label: 'HR & Payroll',
        children: [
          navItem('people', '/people', 'People', <UserOutlined />),
          placeholderItem('placeholder:employee_records', 'Employee Records'),
          placeholderItem('placeholder:attendance', 'Attendance'),
          placeholderItem('placeholder:leave_management', 'Leave Management'),
          placeholderItem('placeholder:basic_payroll', 'Basic Payroll'),
        ],
      },
      {
        key: 'group-operations',
        icon: <ToolOutlined />,
        label: 'Operations',
        children: [
          placeholderItem('placeholder:tasks', 'Tasks'),
          placeholderItem('placeholder:activities', 'Activities'),
          placeholderItem('placeholder:approval_workflows', 'Approval Workflows'),
          placeholderItem('placeholder:production_work_orders', 'Basic Production / Work Orders'),
        ],
      },
      {
        key: 'group-website-ecommerce',
        icon: <GlobalOutlined />,
        label: 'Website & E-Commerce',
        children: [
          placeholderItem('placeholder:website_management', 'Website Management'),
          placeholderItem('placeholder:product_catalog_sync', 'Product Catalog Sync'),
          placeholderItem('placeholder:online_orders', 'Online Orders'),
          placeholderItem('placeholder:customer_sync', 'Customer Sync'),
        ],
      },
      {
        key: 'group-administration-settings',
        icon: <SettingOutlined />,
        label: 'Administration & Settings',
        children: [
          navItem('company', '/company', 'Companies', <ShopOutlined />),
          // Only the account that owns the workspace sees this. Appended
          // conditionally for the same reason as the pipeline entry: the entry
          // does not exist at all for an employee.
          ...(isOwner
            ? [
                {
                  key: 'user-management',
                  icon: <TeamOutlined />,
                  label: <Link to="/user-management">User Management</Link>,
                  ungated: true,
                },
              ]
            : []),
          navItem('generalSettings', '/settings', 'Settings', <SettingOutlined />),
          placeholderItem('placeholder:role_permissions', 'Role-Based Permissions'),
          placeholderItem('placeholder:audit_history', 'Audit History'),
          placeholderItem('placeholder:department_management', 'Department Management'),
        ],
      },
    ],
    [canSeePipeline, isOwner]
  );

  const visibleItems = useMemo(
    () => filterByModules(groups, currentAdmin),
    [groups, currentAdmin]
  );

  // The parent of the route on screen. `visibleItems`, not `groups`: the active
  // route must never put the key of a group this account cannot see into
  // `openKeys`.
  const activeParent = parentKeyFor(visibleItems, selectedKey);

  // At most one parent is ever expanded. State holds an array because that is
  // the Menu API's shape, but every writer below produces zero or one key.
  const [openKeys, setOpenKeys] = useState(() => (activeParent ? [activeParent] : []));

  /*
   * Navigation - not a click on a header - keeps the active group open.
   *
   * Replace rather than append: with a single-accordion state, appending would
   * briefly hold two keys and let the next toggle close the wrong group. The
   * guard leaves an already-correct single key alone, so clicking a child of
   * the open group does not cause a pointless render.
   *
   * `selectedKey` is a dependency as well as `activeParent` because moving
   * between two children of the same parent leaves `activeParent` unchanged;
   * the active child must still find its group open.
   */
  useEffect(() => {
    if (!activeParent) return;

    setOpenKeys((current) =>
      current.length === 1 && current[0] === activeParent ? current : [activeParent]
    );
  }, [activeParent, selectedKey]);

  /*
   * The single-accordion rule.
   *
   * Menu hands back the complete set of open keys, not the delta, so:
   *   - a key that was not open before is the header just clicked - keep only
   *     that one, closing whichever group was open;
   *   - no new key means the click closed the open header - keep nothing.
   *
   * This only changes which dropdown is expanded. Parent headers are submenu
   * titles with no link and no route of their own, so toggling one cannot
   * navigate or reload the page.
   */
  const handleOpenChange = (keys) => {
    const opened = keys.filter((key) => !openKeys.includes(key));

    setOpenKeys(opened.length > 0 ? [opened[opened.length - 1]] : []);
  };

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
        selectedKeys={[selectedKey]}
        openKeys={openKeys}
        onOpenChange={handleOpenChange}
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
