import { ALL_MODULES, resolveModules } from './modulePermissions';

/**
 * The grantable ERP modules, with the labels and grouping the permission
 * checklist renders.
 *
 * The keys are taken from ALL_MODULES in utils/modulePermissions.js rather than
 * written out again, so the two can never drift: that file already mirrors
 * MODULE_KEYS in backend/src/utils/moduleList.js, which is the authority and
 * rejects any key it does not know. This file adds only presentation.
 *
 * A key with no entry below still renders, labelled with its raw key, in
 * "Other". That is deliberately ugly - it means a module was added to the
 * backend and to ALL_MODULES without anyone deciding where it belongs in the
 * UI, and a visible oddity is a better outcome than a checkbox that silently
 * does not appear.
 */
const PRESENTATION = {
  dashboard: ['Dashboard & Reports', 'Overview'],
  report: ['Report', 'Overview'],

  invoice: ['Invoices', 'Sales'],
  quote: ['Quotes', 'Sales'],
  payment: ['Payments', 'Sales'],
  order: ['Orders', 'Sales'],
  offer: ['Offers for Leads', 'Sales'],
  lead: ['Leads', 'Sales'],

  customer: ['Customers', 'Contacts'],
  people: ['People', 'Contacts'],
  company: ['Companies', 'Contacts'],

  product: ['Products', 'Catalog'],
  'category/product': ['Products Category', 'Catalog'],

  expenses: ['Expenses', 'Finance'],
  'category/expenses': ['Expenses Category', 'Finance'],
  taxes: ['Taxes', 'Finance'],

  generalSettings: ['Settings', 'System'],
  help: ['Help', 'System'],
};

// Rendered in this order; anything unlisted follows, in ALL_MODULES order.
const GROUP_ORDER = ['Overview', 'Sales', 'Contacts', 'Catalog', 'Finance', 'System', 'Other'];

export const ERP_MODULES = ALL_MODULES.map((key) => {
  const [label, group] = PRESENTATION[key] ?? [key, 'Other'];
  return { key, label, group };
});

export const MODULE_GROUPS = [...new Set(ERP_MODULES.map((module) => module.group))].sort(
  (a, b) => {
    const ai = GROUP_ORDER.indexOf(a);
    const bi = GROUP_ORDER.indexOf(b);
    return (ai === -1 ? GROUP_ORDER.length : ai) - (bi === -1 ? GROUP_ORDER.length : bi);
  }
);

export const modulesInGroup = (group) => ERP_MODULES.filter((module) => module.group === group);

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
    count: permissions.length,
    labels: permissions.map(labelForKey),
  };
};
