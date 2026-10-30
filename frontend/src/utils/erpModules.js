import { ALL_MODULES, resolveModules } from './modulePermissions';

/**
 * The ERP's ten parent modules, in sidebar order, with the grantable children
 * under each and the placeholders that have no implementation yet.
 *
 * The parent is a RENDERING hierarchy, not a second permission layer. It has no
 * key of its own and cannot be granted; it is shown when at least one of its
 * children is held. That is why every parent below carries `order` (the
 * grantable keys) and `placeholders` (entries that are drawn but do nothing).
 *
 * The exception is a roadmap parent - one with no implemented child at all
 * (Purchase & Suppliers, POS, Operations, Website & E-Commerce). There is no
 * held child to infer visibility from, so each carries a `grantKey` and is
 * drawn only when that key is in the account's STORED permissions. The key is a
 * real member of ALL_MODULES, so the checklists can tick the parent itself; the
 * sidebar then reads the same key back. See hasExplicitModule in
 * modulePermissions.js for why the stored list, not the resolved one, decides.
 *
 * Placeholders are deliberately NOT in ALL_MODULES. Granting one would hand out
 * a capability that does not exist - a checked box that changes nothing - so
 * they are presentation only and the checklists render them disabled. They are
 * still listed here, in the shared registry, because the sidebar, the
 * permission checklist and the checklist's "Soon" tags all have to agree about
 * which entries exist.
 *
 * The grantable keys are still checked against ALL_MODULES, which mirrors the
 * backend's MODULE_KEYS - the authority. If a key is added to the backend and
 * to ALL_MODULES but not placed in `order` below, it falls into the "Other"
 * group rather than disappearing: a visible oddity is better than a checkbox
 * nobody can find.
 */
export const MODULE_GROUPS = [
  {
    key: 'dashboard-reports',
    label: 'Dashboard & Reports',
    order: ['dashboard'],
    placeholders: [{ key: 'placeholder:reports', label: 'Reports' }],
  },
  {
    key: 'sales-crm',
    label: 'Sales & CRM',
    order: [
      'customer',
      'lead',
      'quote',
      'offer',
      'order',
      'sales_followups',
      'sales_targets',
      'sales_forecasting',
    ],
    // Sales Pipeline has no checkbox and should not get one: it is a second view
    // of the `lead` module, served entirely by /api/lead/*, so the Leads grant
    // already covers it. See utils/salesPipeline.js.
    placeholders: [],
  },
  {
    key: 'accounting-finance',
    label: 'Accounting & Finance',
    order: ['invoice', 'payment', 'expenses', 'category/expenses', 'taxes'],
    placeholders: [
      { key: 'placeholder:chart_of_accounts', label: 'Chart of Accounts' },
      { key: 'placeholder:vouchers', label: 'Vouchers' },
      { key: 'placeholder:ledger', label: 'Ledger' },
      { key: 'placeholder:customer_supplier_balances', label: 'Customer / Supplier Balances' },
      { key: 'placeholder:financial_statements', label: 'Financial Statements' },
    ],
  },
  {
    key: 'products-inventory',
    label: 'Products & Inventory',
    order: ['product', 'category/product'],
    placeholders: [
      { key: 'placeholder:stock_tracking', label: 'Stock Tracking' },
      { key: 'placeholder:warehouses', label: 'Warehouses' },
      { key: 'placeholder:stock_adjustments', label: 'Stock Adjustments' },
      { key: 'placeholder:stock_transfers', label: 'Stock Transfers' },
    ],
  },
  {
    key: 'purchase-suppliers',
    label: 'Purchase & Suppliers',
    grantKey: 'purchase_group',
    order: [],
    placeholders: [
      { key: 'placeholder:suppliers', label: 'Suppliers' },
      { key: 'placeholder:purchase_orders', label: 'Purchase Orders' },
      { key: 'placeholder:goods_received', label: 'Goods Received' },
      { key: 'placeholder:supplier_bills', label: 'Supplier Bills' },
    ],
  },
  {
    key: 'pos',
    label: 'POS (Point of Sale)',
    grantKey: 'pos_group',
    order: [],
    placeholders: [
      { key: 'placeholder:pos_billing', label: 'POS Billing' },
      { key: 'placeholder:pos_sales_transactions', label: 'Sales Transactions' },
      { key: 'placeholder:pos_payment_processing', label: 'Payment Processing' },
      { key: 'placeholder:pos_receipt_generation', label: 'Receipt Generation' },
      { key: 'placeholder:pos_inventory_sync', label: 'POS Inventory Synchronization' },
    ],
  },
  {
    key: 'hr-payroll',
    label: 'HR & Payroll',
    order: ['people'],
    placeholders: [
      { key: 'placeholder:employee_records', label: 'Employee Records' },
      { key: 'placeholder:attendance', label: 'Attendance' },
      { key: 'placeholder:leave_management', label: 'Leave Management' },
      { key: 'placeholder:basic_payroll', label: 'Basic Payroll' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    grantKey: 'operations_group',
    order: [],
    placeholders: [
      { key: 'placeholder:tasks', label: 'Tasks' },
      { key: 'placeholder:activities', label: 'Activities' },
      { key: 'placeholder:approval_workflows', label: 'Approval Workflows' },
      { key: 'placeholder:production_work_orders', label: 'Basic Production / Work Orders' },
    ],
  },
  {
    key: 'website-ecommerce',
    label: 'Website & E-Commerce',
    order: [
      'website_management',
      'product_sync',
      'online_orders',
      'customer_sync',
    ],
    placeholders: [],
  },
  {
    key: 'administration-settings',
    label: 'Administration & Settings',
    order: ['company', 'generalSettings', 'help'],
    // User Management is owner-only and deliberately not grantable, so it has no
    // checkbox. It is still in the sidebar's Administration group.
    placeholders: [
      { key: 'placeholder:role_permissions', label: 'Role-Based Permissions' },
      { key: 'placeholder:audit_history', label: 'Audit History' },
      { key: 'placeholder:department_management', label: 'Department Management' },
    ],
  },
];

// Where each grantable key lives, and what it is called. Kept as a flat table
// rather than nested inside MODULE_GROUPS so ERP_MODULES can be derived from
// ALL_MODULES - the list that mirrors the server - instead of from a second
// hand-written list of keys.
const PRESENTATION = {
  dashboard: ['Dashboard', 'dashboard-reports'],

  customer: ['Customers', 'sales-crm'],
  lead: ['Leads', 'sales-crm'],
  quote: ['Quotes', 'sales-crm'],
  offer: ['Offers for Leads', 'sales-crm'],
  order: ['Orders', 'sales-crm'],
  sales_followups: ['Sales Follow-ups', 'sales-crm'],
  sales_targets: ['Sales Targets', 'sales-crm'],
  sales_forecasting: ['Sales Forecasting', 'sales-crm'],

  invoice: ['Invoices', 'accounting-finance'],
  payment: ['Payments', 'accounting-finance'],
  expenses: ['Expenses', 'accounting-finance'],
  'category/expenses': ['Expenses Category', 'accounting-finance'],
  taxes: ['Taxes', 'accounting-finance'],

  product: ['Products', 'products-inventory'],
  'category/product': ['Products Category', 'products-inventory'],

  people: ['People', 'hr-payroll'],

  company: ['Companies', 'administration-settings'],
  generalSettings: ['Settings', 'administration-settings'],
  help: ['Help', 'administration-settings'],

  // Website & E-Commerce
  website_management: ['Website Management', 'website-ecommerce'],
  product_sync: ['Product Catalog Sync', 'website-ecommerce'],
  online_orders: ['Online Orders', 'website-ecommerce'],
  customer_sync: ['Customer Sync', 'website-ecommerce'],

  // The roadmap parents' own keys. They are placed in a pseudo-group that no
  // checklist iterates, so they never render as a child checkbox - the parent
  // header for each is the only control. They still have to be in ERP_MODULES:
  // that is what makes them known keys, counted in the summary, and accepted by
  // describePermissions.
  purchase_group: ['Purchase & Suppliers', 'roadmap'],
  pos_group: ['POS (Point of Sale)', 'roadmap'],
  operations_group: ['Operations', 'roadmap'],
  website_group: ['Website & E-Commerce', 'roadmap'],
};

const OTHER_GROUP = {
  key: 'other',
  label: 'Other',
  order: [],
  placeholders: [],
};

/**
 * Holds the roadmap parents' keys so groupLabelFor can name them. It is never
 * rendered as a checklist section - MODULE_GROUPS_IN_ORDER includes a group only
 * when it has children or placeholders, and this one has neither.
 */
const ROADMAP_GROUP = {
  key: 'roadmap',
  label: 'Roadmap',
  order: [],
  placeholders: [],
};

const ALL_GROUPS = [...MODULE_GROUPS, OTHER_GROUP, ROADMAP_GROUP];

const groupLabelFor = (key) =>
  ALL_GROUPS.find((group) => group.key === key)?.label ?? OTHER_GROUP.label;

/** The flat list of grantable modules, labelled and placed. */
export const ERP_MODULES = ALL_MODULES.map((key) => {
  const [label, group] = PRESENTATION[key] ?? [key, 'other'];

  return { key, label, group, groupLabel: groupLabelFor(group) };
});

/** The groups a checklist should render, in order, including "Other" only when used. */
export const MODULE_GROUPS_IN_ORDER = ALL_GROUPS.filter(
  (group) => group.order.length > 0 || group.placeholders.length > 0
);

/**
 * The grantable modules in one group, in the order the sidebar shows them.
 *
 * Anything placed in the group by PRESENTATION but missing from `order` is
 * appended rather than dropped - see the file comment.
 */
export const modulesInGroup = (groupKey) => {
  const group = ALL_GROUPS.find((item) => item.key === groupKey);
  const inGroup = ERP_MODULES.filter((module) => module.group === groupKey);

  if (!group) return inGroup;

  const byKey = new Map(inGroup.map((module) => [module.key, module]));
  const ordered = group.order.map((key) => byKey.get(key)).filter(Boolean);
  const placed = new Set(ordered.map((module) => module.key));

  return [...ordered, ...inGroup.filter((module) => !placed.has(module.key))];
};

export const placeholdersInGroup = (groupKey) =>
  ALL_GROUPS.find((item) => item.key === groupKey)?.placeholders ?? [];

export const labelForKey = (key) => ERP_MODULES.find((module) => module.key === key)?.label ?? key;

/**
 * The modules this account is allowed to hand out - its own effective set.
 *
 * An unrestricted account (an empty allow-list) holds everything, which is the
 * same rule the backend's resolveModules applies and the same one the server
 * enforces on write: a Customer Admin may only grant modules they hold
 * themselves. Reading it through the shared helper means the checkboxes and the
 * server's rejection can never disagree about what was on offer.
 */
export const grantableFor = (admin) => resolveModules(admin) ?? ALL_MODULES;

/** Human-readable summary of a permission list, for a card's tag. */
export const describePermissions = (permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return { all: true, count: ERP_MODULES.length, labels: [] };
  }

  return {
    all: false,
    // Ignore retired and placeholder keys when counting: they grant nothing, so
    // counting them would overstate what the account can reach.
    count: permissions.filter((key) => ERP_MODULES.some((module) => module.key === key)).length,
    labels: permissions.map(labelForKey),
  };
};
