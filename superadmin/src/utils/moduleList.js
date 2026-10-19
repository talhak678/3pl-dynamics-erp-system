/**
 * The ERP modules a tenant account can be granted, grouped under the ten parent
 * modules the sidebar renders.
 *
 * The 20 grantable keys MUST stay byte-identical to MODULE_KEYS in the backend's
 * src/utils/moduleList.js - that file is the validation whitelist, and a key
 * present here but absent there is rejected with a 400 "Unknown module key".
 * The backend deliberately does not expose its list over the API, so this is a
 * hand-maintained mirror.
 *
 * The three `sales_*` keys are additive: every key that existed before them is
 * unchanged, so an account saved before this feature keeps every grant it had.
 * 'report' was retired earlier and is gone from both sides.
 *
 * The parent groups are a rendering hierarchy, not a second permission layer.
 * A parent has no key and cannot be granted; it is drawn when at least one of
 * its children is held. Placeholders are presentation only - granting one would
 * grant nothing - so they live in `placeholders` and render disabled.
 *
 * An empty allow-list means EVERY module, not none - see EMPTY_MEANS_ALL below.
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
    // Sales Pipeline is a second view of `lead` and has no grantable key of its
    // own. See frontend/src/utils/salesPipeline.js.
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
    order: [],
    placeholders: [
      { key: 'placeholder:website_management', label: 'Website Management' },
      { key: 'placeholder:product_catalog_sync', label: 'Product Catalog Sync' },
      { key: 'placeholder:online_orders', label: 'Online Orders' },
      { key: 'placeholder:customer_sync', label: 'Customer Sync' },
    ],
  },
  {
    key: 'administration-settings',
    label: 'Administration & Settings',
    order: ['company', 'generalSettings', 'help'],
    placeholders: [
      { key: 'placeholder:role_permissions', label: 'Role-Based Permissions' },
      { key: 'placeholder:audit_history', label: 'Audit History' },
      { key: 'placeholder:department_management', label: 'Department Management' },
    ],
  },
];

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
};

const OTHER_GROUP = { key: 'other', label: 'Other', order: [], placeholders: [] };

const ALL_GROUPS = [...MODULE_GROUPS, OTHER_GROUP];

const groupLabelFor = (key) =>
  ALL_GROUPS.find((group) => group.key === key)?.label ?? OTHER_GROUP.label;

/**
 * The flat list, in the order the API and the old checklist expected. Derived
 * from the keys in PRESENTATION rather than written a third time, so a module
 * can never be in the group tree and absent from the flat list.
 */
export const ERP_MODULES = Object.keys(PRESENTATION).map((key) => {
  const [label, group] = PRESENTATION[key];
  return { key, label, group, groupLabel: groupLabelFor(group) };
});

export const MODULE_KEYS = ERP_MODULES.map((module) => module.key);

export const MODULE_GROUPS_IN_ORDER = ALL_GROUPS.filter(
  (group) => group.order.length > 0 || group.placeholders.length > 0
);

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

/**
 * The backend resolves an empty or missing modulePermissions array to "all
 * modules" (see resolveModules). So a tenant with nothing ticked has FULL
 * access, not none. The UI has to say this out loud, or an admin clearing every
 * checkbox will believe they revoked access while doing the exact opposite.
 *
 * There is no way to express "no modules" through this API.
 */
export const EMPTY_MEANS_ALL = true;

export const labelForKey = (key) => ERP_MODULES.find((module) => module.key === key)?.label ?? key;

/** Human-readable summary of a permission list, for tags and tooltips. */
export const describePermissions = (permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return { all: true, count: MODULE_KEYS.length, labels: [] };
  }
  return {
    all: false,
    count: permissions.filter((key) => MODULE_KEYS.includes(key)).length,
    labels: permissions.map(labelForKey),
  };
};
