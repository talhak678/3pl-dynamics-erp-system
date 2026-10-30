const express = require('express');
const { catchErrors } = require('../../handlers/errorHandlers');
const router = express.Router();

const appControllers = require('../../controllers/appControllers');
const { routesList } = require('../../models/utils');
const requireModuleAccess = require('../../middlewares/requireModuleAccess');
const salesForecastController = require('../../controllers/appControllers/salesForecastController');
const ecommerceController = require('../../controllers/appControllers/ecommerceController');

// Registered ahead of the entity routes below so it runs first for every request
// this router handles. req.admin is already populated by the time we get here:
// app.js mounts this router behind adminAuth.isValidAuthToken.
router.use(requireModuleAccess);

const routerApp = (entity, controller) => {
  router.route(`/${entity}/create`).post(catchErrors(controller['create']));
  router.route(`/${entity}/read/:id`).get(catchErrors(controller['read']));
  router.route(`/${entity}/update/:id`).patch(catchErrors(controller['update']));
  router.route(`/${entity}/delete/:id`).delete(catchErrors(controller['delete']));
  router.route(`/${entity}/search`).get(catchErrors(controller['search']));
  router.route(`/${entity}/list`).get(catchErrors(controller['list']));
  router.route(`/${entity}/listAll`).get(catchErrors(controller['listAll']));
  router.route(`/${entity}/filter`).get(catchErrors(controller['filter']));
  router.route(`/${entity}/summary`).get(catchErrors(controller['summary']));

  if (entity === 'invoice' || entity === 'quote' || entity === 'payment') {
    router.route(`/${entity}/mail`).post(catchErrors(controller['mail']));
  }

  if (entity === 'quote') {
    router.route(`/${entity}/convert/:id`).get(catchErrors(controller['convert']));
  }
};

routesList.forEach(({ entity, controllerName }) => {
  const controller = appControllers[controllerName];
  routerApp(entity, controller);
});

/**
 * Sales Forecasting is the one module with no model behind it, so it gets no
 * automatic route: routesList is generated from the filenames in
 * models/appModels, and there is deliberately no SalesForecast model - every
 * figure is derived on read. The route is written out here, under the same
 * requireModuleAccess guard mounted above, which resolves the `salesforecast`
 * first segment to the `sales_forecasting` key through ENTITY_MODULE_MAP.
 *
 * Registered after the entity routes for readability only; no entity is named
 * `salesforecast`, so nothing above can match this path.
 */
router
  .route('/salesforecast/summary')
  .get(catchErrors(salesForecastController.summary));

/**
 * Website & E-Commerce Synchronization Routes
 */
router.route('/ecommerce/sync-products').post(catchErrors(ecommerceController.syncProducts));
router.route('/ecommerce/fetch-orders').get(catchErrors(ecommerceController.fetchOrders));
router.route('/ecommerce/test-connection').post(catchErrors(ecommerceController.testConnection));
router.route('/ecommerce/convert-order/:id').post(catchErrors(ecommerceController.convertOrderToErp));
router.route('/ecommerce/link-customer/:id').post(catchErrors(ecommerceController.linkCustomerToCrm));
router.route('/ecommerce/sync-customers').post(catchErrors(ecommerceController.syncCustomers));

module.exports = router;
