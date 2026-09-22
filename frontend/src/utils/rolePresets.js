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
  // The whole sales workflow end to end, and the only preset that carries a
  // module the others deliberately leave out. A Sales Manager both works leads
  // and owns the paperwork that closes them, so the two halves - the pipeline
  // (lead, customer, company, people) and the documents (offer, quote, invoice,
  // payment) - are granted together. Splitting them would leave a manager able
  // to qualify a lead but not to bill it.
  //
  // `taxes` is pulled in by the three document forms rather than chosen: quote,
  // offer and invoice each fetch /api/taxes/* for their tax picker, so granting
  // any one of them without `taxes` is the 403-that-renders-as-"No data"
  // failure described above. See the dependency list.
  //
  // Unlike Sales Executive this is an ordinary label - it narrows no data
  // scope, so a Sales Manager sees the whole workspace exactly as the owner
  // does.
  'Sales Manager': [
    'dashboard',
    'lead',
    'customer',
    'company',
    'people',
    'offer',
    'quote',
    'invoice',
    'payment',
    'taxes',
  ],

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
  //
  // Renamed from 'Customer Support' with the preset unchanged, which is the
  // whole intent of the rename: the title reads better and nothing about the job
  // moved. The old key is gone from here, so an account still carrying the old
  // string gets no preset - see the note on ASSIGNABLE_ROLE_OPTIONS below.
  'Support Agent': ['dashboard', 'customer', 'company', 'people', 'quote', 'taxes'],
};

/**
 * The titles the Role dropdown offers, in the order it offers them.
 *
 * Every title here now has a preset, so `presetFor` returns null only for a
 * retired title an existing member still carries - which is what leaves the
 * checkboxes untouched when such a member is opened and saved unchanged.
 *
 * Retired titles ('Manager', 'Digital Marketer', 'admin', and the pre-rename
 * 'employee' and 'Customer Support') are absent. An existing member carrying one
 * still renders correctly - MemberFormDrawer appends the member's current role
 * when the dropdown does not offer it - so opening such a member does not
 * silently rewrite their job title.
 *
 * 'Read Only / Viewer' is NOT here either, for a third reason: it is a preview
 * of a role the server would refuse, hardcoded as a disabled option in
 * MemberFormDrawer. Adding it to this list would put it in the request body of
 * any form that submitted it, and `validateRequestedRole` would answer "Unknown
 * role". This array is the set the server accepts; the dropdown is that set plus
 * one option that cannot be picked.
 */
export const ASSIGNABLE_ROLE_OPTIONS = [
  { label: 'Sales Manager', value: 'Sales Manager' },
  { label: SALES_EXECUTIVE_ROLE, value: SALES_EXECUTIVE_ROLE },
  { label: 'Accountant', value: 'Accountant' },
  { label: 'Marketing Manager', value: 'Marketing Manager' },
  { label: 'Inventory Manager', value: 'Inventory Manager' },
  { label: 'Support Agent', value: 'Support Agent' },
];

/** The modules a title pre-ticks, or null when it pre-ticks nothing. */
export const presetFor = (role) => ROLE_PRESETS[role] ?? null;

/**
 * How a stored title is written on screen.
 *
 * Every assignable title is already Title-Cased, so for those this returns the
 * value untouched. It exists for the retired ones, which are not all: the
 * pre-rename 'employee' is stored lowercase, and it is displayed in two places
 * that have to agree - the member card and the Role dropdown that appends a
 * member's stored title when it is no longer offered. Rendering it raw in one
 * and Title-Cased in the other is how the same person reads as two different
 * jobs depending on where you look.
 *
 * A display helper only. It never touches the value that is stored or
 * submitted: an account keeps its old title until an admin saves it onto a
 * current one, and nothing here migrates it on a page load.
 *
 * Capitalises each word rather than the first character alone, so a stored
 * 'customer support' would read the same as the 'Customer Support' it was
 * renamed from.
 */
export const roleLabel = (role) => {
  if (typeof role !== 'string' || role === '') return '';

  return role
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
};
