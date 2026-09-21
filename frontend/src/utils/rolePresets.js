import { SALES_EXECUTIVE_MODULES, SALES_EXECUTIVE_ROLE } from './salesPipeline';

/**
 * The job titles a Customer Admin may assign, and the modules each one works
 * with.
 *
 * Mirrors ASSIGNABLE_ROLES in backend/src/utils/roles.js. That file is the
 * authority: a title offered here but absent there is refused by the server, and
 * a title there but absent here is assignable only through the API. The two
 * lists are short enough to read side by side, which is the point.
 *
 * A role is a label, not a permission. Nothing in this codebase grants module
 * access from `role` - that is `modulePermissions`, decided by the checkboxes.
 * These arrays exist because the two are chosen together in practice: an
 * accountant who cannot open the invoices module has nothing to account for,
 * and the admin filling the form has no reason to know that off-hand.
 *
 * Sales Executive is the one exception, and it is not an exception made here.
 * It narrows a real data scope on the backend (see middlewares/ownership.js) and
 * is the only title anything branches on besides 'owner'.
 */

/**
 * The modules each title pre-ticks.
 *
 * Every array is CLOSED UNDER THE PICKER DEPENDENCIES - if a module is listed,
 * every module its forms fetch is listed too. That is not tidiness. A module
 * granted without its partners renders a picker that returns 403, shows "No
 * data" instead of an error, and leaves a form that cannot be submitted - the
 * exact failure a Sales Executive hit on the Company field. The dependencies,
 * all read from the forms themselves:
 *
 *   lead     -> company, people     (pages/Lead/config.js)
 *   offer    -> lead, taxes         (OfferModule/Forms/OfferForm.jsx)
 *   quote    -> customer, taxes     (QuoteModule/Forms/QuoteForm.jsx)
 *   invoice  -> customer, taxes     (InvoiceModule/Forms/InvoiceForm.jsx)
 *   product  -> category/product    (pages/Product/config.js)
 *   expenses -> category/expenses   (pages/Expense/config.js)
 *   company  -> people              (pages/Company/config.js)
 *   people   -> company             (pages/People/config.js)
 *
 * Adding a module to any array below means checking that list first. There is
 * no runtime guard for this; it is a property of the data.
 *
 * 'report' appears in none of them and never should - it is a key with no page,
 * no route and no navigation entry.
 */
export const ROLE_PRESETS = {
  [SALES_EXECUTIVE_ROLE]: SALES_EXECUTIVE_MODULES,

  // Every finance entity is real, and this is the only title that needs the
  // expense category tree. `customer` and `taxes` are not optional: the invoice
  // form's pickers fetch both.
  Accountant: ['dashboard', 'invoice', 'payment', 'customer', 'taxes', 'expenses', 'category/expenses'],

  // Demand generation, without the money modules. Deliberately narrower than
  // Sales Executive: marketing qualifies leads, it does not work the pipeline,
  // and the board is role-locked to owner and Sales Executive anyway.
  'Marketing Manager': ['dashboard', 'lead', 'customer', 'company', 'people'],

  // The stock side of the business. No verified dependency draws this outward.
  'Inventory Manager': ['dashboard', 'product', 'category/product', 'order'],

  // Answers customer questions from real records, but holds no invoice access -
  // there is no read-only grant in this system, so `invoice` would let support
  // staff edit and delete them.
  'Customer Support': ['dashboard', 'customer', 'company', 'people', 'quote', 'taxes'],
};

/**
 * The titles the Role dropdown offers.
 *
 * 'employee' is present with no preset, deliberately: it is the blank slate, and
 * `presetFor` returning null for it is what leaves the checkboxes untouched when
 * an admin picks it.
 *
 * Retired titles ('Manager', 'Digital Marketer', 'admin') are absent. An
 * existing member carrying one still renders correctly - MemberFormDrawer
 * appends the member's current role when the dropdown does not offer it - so
 * opening such a member does not silently rewrite their job title.
 */
export const ASSIGNABLE_ROLE_OPTIONS = [
  { label: 'Employee', value: 'employee' },
  { label: SALES_EXECUTIVE_ROLE, value: SALES_EXECUTIVE_ROLE },
  { label: 'Accountant', value: 'Accountant' },
  { label: 'Marketing Manager', value: 'Marketing Manager' },
  { label: 'Inventory Manager', value: 'Inventory Manager' },
  { label: 'Customer Support', value: 'Customer Support' },
];

/** The modules a title pre-ticks, or null when it pre-ticks nothing. */
export const presetFor = (role) => ROLE_PRESETS[role] ?? null;
