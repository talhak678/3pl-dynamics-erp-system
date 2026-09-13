/**
 * The ERP modules a tenant account can be granted.
 *
 * These 18 keys MUST stay byte-identical to MODULE_KEYS in the backend's
 * src/utils/moduleList.js — that file is the validation whitelist, and a key
 * present here but absent there is rejected with a 400 "Unknown module key".
 * The backend deliberately does not expose its list over the API, so this is a
 * hand-maintained mirror.
 *
 * An empty allow-list means EVERY module, not none — see EMPTY_MEANS_ALL below.
 */
export const ERP_MODULES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { key: 'report', label: 'Report', group: 'Overview' },

  { key: 'invoice', label: 'Invoices', group: 'Sales' },
  { key: 'quote', label: 'Quotes', group: 'Sales' },
  { key: 'payment', label: 'Payments', group: 'Sales' },
  { key: 'order', label: 'Orders', group: 'Sales' },
  { key: 'offer', label: 'Offers for Leads', group: 'Sales' },
  { key: 'lead', label: 'Leads', group: 'Sales' },

  { key: 'customer', label: 'Customers', group: 'Contacts' },
  { key: 'people', label: 'People', group: 'Contacts' },
  { key: 'company', label: 'Companies', group: 'Contacts' },

  { key: 'product', label: 'Products', group: 'Catalog' },
  { key: 'category/product', label: 'Products Category', group: 'Catalog' },

  { key: 'expenses', label: 'Expenses', group: 'Finance' },
  { key: 'category/expenses', label: 'Expenses Category', group: 'Finance' },
  { key: 'taxes', label: 'Taxes', group: 'Finance' },

  { key: 'generalSettings', label: 'Settings', group: 'System' },
  { key: 'help', label: 'Help', group: 'System' },
];

// Derived so the grouping can never drift out of sync with the module list.
// A Set preserves insertion order, which is the order above.
export const MODULE_GROUPS = [...new Set(ERP_MODULES.map((module) => module.group))];

export const MODULE_KEYS = ERP_MODULES.map((module) => module.key);

export const modulesInGroup = (group) => ERP_MODULES.filter((module) => module.group === group);

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
  return { all: false, count: permissions.length, labels: permissions.map(labelForKey) };
};
