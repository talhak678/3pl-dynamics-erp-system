import { lazy } from 'react';

import { Navigate } from 'react-router-dom';

import RequireModule from './RequireModule';
import RequireModuleHome from './RequireModuleHome';
import RequireOwner from './RequireOwner';
import RequireSalesPipeline from './RequireSalesPipeline';

const Logout = lazy(() => import('@/pages/Logout.jsx'));
const NotFound = lazy(() => import('@/pages/NotFound.jsx'));

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Customer = lazy(() => import('@/pages/Customer'));
const Invoice = lazy(() => import('@/pages/Invoice'));
const InvoiceCreate = lazy(() => import('@/pages/Invoice/InvoiceCreate'));

const InvoiceRead = lazy(() => import('@/pages/Invoice/InvoiceRead'));
const InvoiceUpdate = lazy(() => import('@/pages/Invoice/InvoiceUpdate'));
const InvoiceRecordPayment = lazy(() => import('@/pages/Invoice/InvoiceRecordPayment'));

const Quote = lazy(() => import('@/pages/Quote'));
const QuoteCreate = lazy(() => import('@/pages/Quote/QuoteCreate'));
const QuoteRead = lazy(() => import('@/pages/Quote/QuoteRead'));
const QuoteUpdate = lazy(() => import('@/pages/Quote/QuoteUpdate'));

const Payment = lazy(() => import('@/pages/Payment/index'));
const PaymentRead = lazy(() => import('@/pages/Payment/PaymentRead'));
const PaymentUpdate = lazy(() => import('@/pages/Payment/PaymentUpdate'));

const Settings = lazy(() => import('@/pages/Settings/Settings'));
const PaymentMode = lazy(() => import('@/pages/PaymentMode'));
const Taxes = lazy(() => import('@/pages/Taxes'));
const People = lazy(() => import('@/pages/People'));
const Company = lazy(() => import('@/pages/Company'));
const Lead = lazy(() => import('@/pages/Lead'));
const Offer = lazy(() => import('@/pages/Offer'));
const OfferCreate = lazy(() => import('@/pages/Offer/OfferCreate'));
const OfferRead = lazy(() => import('@/pages/Offer/OfferRead'));
const OfferUpdate = lazy(() => import('@/pages/Offer/OfferUpdate'));
const Product = lazy(() => import('@/pages/Product'));
const ProductCategory = lazy(() => import('@/pages/ProductCategory'));
const Order = lazy(() => import('@/pages/Order'));
const Expense = lazy(() => import('@/pages/Expense'));
const ExpenseCategory = lazy(() => import('@/pages/ExpenseCategory'));

const Profile = lazy(() => import('@/pages/Profile'));

const UserManagement = lazy(() => import('@/pages/UserManagement'));

const SalesPipeline = lazy(() => import('@/pages/SalesPipeline'));

const About = lazy(() => import('@/pages/About'));

/**
 * Attaches the route guard. The module key is written next to the path it
 * protects rather than derived, so a route and its module can never drift apart
 * — the module is named at the route it applies to.
 *
 * A route left unguarded is a deliberate choice, not an omission:
 *
 *   /login, /logout  must stay reachable — refusing the page a tenant signs out
 *                    through would strand them.
 *   /profile         cross-cutting, like /admin/profile on the backend: it is
 *                    the account's own details, not a module.
 *   /payment/mode    no module key covers it (its navigation entry is commented
 *                    out in NavigationContainer.jsx), and the backend guard
 *                    lets it through for the same reason.
 *   *                the 404 must render for any path at all.
 */
const guarded = (module, element) => <RequireModule module={module}>{element}</RequireModule>;

let routes = {
  expense: [],
  default: [
    {
      path: '/login',
      element: <Navigate to="/" />,
    },
    {
      path: '/logout',
      element: <Logout />,
    },
    {
      // Same component as /help, and reachable by typing it even though nothing
      // links here. Guarded identically so it is not a way around that guard.
      path: '/about',
      element: guarded('help', <About />),
    },
    {
      path: '/help',
      element: guarded('help', <About />),
    },
    {
      path: '/',
      // Not `guarded('dashboard', ...)`. This is where signing in lands, and an
      // account without the dashboard module would be refused the page it was
      // just sent to. The guard renders the dashboard when it is held and
      // forwards to the first module that is otherwise - see RequireModuleHome.
      element: (
        <RequireModuleHome>
          <Dashboard />
        </RequireModuleHome>
      ),
    },
    {
      path: '/customer',
      element: guarded('customer', <Customer />),
    },

    {
      path: '/invoice',
      element: guarded('invoice', <Invoice />),
    },
    {
      path: '/invoice/create',
      element: guarded('invoice', <InvoiceCreate />),
    },
    {
      path: '/invoice/read/:id',
      element: guarded('invoice', <InvoiceRead />),
    },
    {
      path: '/invoice/update/:id',
      element: guarded('invoice', <InvoiceUpdate />),
    },
    {
      path: '/invoice/pay/:id',
      element: guarded('invoice', <InvoiceRecordPayment />),
    },
    {
      path: '/quote',
      element: guarded('quote', <Quote />),
    },
    {
      path: '/quote/create',
      element: guarded('quote', <QuoteCreate />),
    },
    {
      path: '/quote/read/:id',
      element: guarded('quote', <QuoteRead />),
    },
    {
      path: '/quote/update/:id',
      element: guarded('quote', <QuoteUpdate />),
    },
    {
      path: '/payment',
      element: guarded('payment', <Payment />),
    },
    {
      path: '/payment/read/:id',
      element: guarded('payment', <PaymentRead />),
    },
    {
      path: '/payment/update/:id',
      element: guarded('payment', <PaymentUpdate />),
    },

    {
      path: '/settings',
      element: guarded('generalSettings', <Settings />),
    },
    {
      path: '/settings/edit/:settingsKey',
      element: guarded('generalSettings', <Settings />),
    },
    {
      path: '/payment/mode',
      element: <PaymentMode />,
    },
    {
      path: '/taxes',
      element: guarded('taxes', <Taxes />),
    },
    {
      path: '/people',
      element: guarded('people', <People />),
    },
    {
      path: '/company',
      element: guarded('company', <Company />),
    },
    {
      path: '/lead',
      element: guarded('lead', <Lead />),
    },
    {
      // A second view of the leads module rather than a module of its own, so
      // it is guarded by role as well as by the `lead` key: the pipeline shows
      // the same rows the API would return for /api/lead/*, and that API is
      // already scoped by ownership.js to an executive's own leads. See
      // utils/salesPipeline.js.
      path: '/sales-pipeline',
      element: (
        <RequireSalesPipeline>
          <SalesPipeline />
        </RequireSalesPipeline>
      ),
    },
    {
      path: '/offer',
      element: guarded('offer', <Offer />),
    },
    {
      path: '/offer/create',
      element: guarded('offer', <OfferCreate />),
    },
    {
      path: '/offer/read/:id',
      element: guarded('offer', <OfferRead />),
    },
    {
      path: '/offer/update/:id',
      element: guarded('offer', <OfferUpdate />),
    },
    {
      path: '/product',
      element: guarded('product', <Product />),
    },
    {
      path: '/category/product',
      element: guarded('category/product', <ProductCategory />),
    },
    {
      path: '/order',
      element: guarded('order', <Order />),
    },
    {
      path: '/expenses',
      element: guarded('expenses', <Expense />),
    },
    {
      path: '/category/expenses',
      element: guarded('category/expenses', <ExpenseCategory />),
    },

    {
      path: '/profile',
      element: <Profile />,
    },
    {
      // Guarded by ownership rather than by a module key, because managing
      // users is a capability of owning the workspace and is deliberately not
      // something an owner can grant away. See RequireOwner.
      path: '/user-management',
      element: (
        <RequireOwner>
          <UserManagement />
        </RequireOwner>
      ),
    },
    {
      path: '*',
      element: <NotFound />,
    },
  ],
};

export default routes;
