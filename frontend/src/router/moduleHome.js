import { resolveModules } from '@/utils/modulePermissions';

/**
 * Where each module lives, for the landing decision below.
 *
 * The paths are the ones in routes.jsx, written out rather than derived, because
 * deriving them would mean importing that file - and it imports the components
 * that use this, so the cycle would be resolved at module-init time, which is
 * exactly when a half-built `routes` object is least safe to read.
 *
 * The duplication cannot fail open. This table is only ever read through a key;
 * a module missing from it is skipped in favour of the next one the account
 * holds, and an account holding no listed module at all ends at AccessDenied
 * rather than at some other page. Both are a visible oddity, not a wrong
 * destination.
 *
 * Every one of the seventeen keys has an entry today.
 *
 * A plain module rather than a hook or a component, because two guards and the
 * refusal screen all need this answer and none of them owns it.
 */
export const MODULE_HOME_PATHS = {
  dashboard: '/',
  invoice: '/invoice',
  quote: '/quote',
  payment: '/payment',
  customer: '/customer',
  people: '/people',
  company: '/company',
  lead: '/lead',
  offer: '/offer',
  product: '/product',
  'category/product': '/category/product',
  order: '/order',
  expenses: '/expenses',
  'category/expenses': '/category/expenses',
  generalSettings: '/settings',
  taxes: '/taxes',
  help: '/help',
};

/**
 * The page this account should land on, or null when no module it holds has a
 * route.
 *
 * `dashboard` wins whenever it is held, so an account that has it is unaffected
 * by any of this.
 *
 * Otherwise it is the first module in the stored array that has a page - first
 * in the account's own order, not in some order of ours, because that array is
 * what the admin arranged and there is no better signal available. The lookup
 * rather than a bare `granted[0]` matters for the one case that actually
 * happens: an array still carrying a retired key, where index 0 would otherwise
 * resolve to nothing and drop the account onto a refusal screen for no reason.
 */
export const landingPathFor = (admin) => {
  const granted = resolveModules(admin);

  // Unrestricted - an absent or empty allow-list means every module, so the
  // dashboard is theirs and there is nothing to redirect.
  if (granted === null) return '/';

  if (granted.includes('dashboard')) return '/';

  const first = granted.find((key) => MODULE_HOME_PATHS[key]);

  return first ? MODULE_HOME_PATHS[first] : null;
};
