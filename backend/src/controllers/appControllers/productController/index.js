const createCRUDController = require('../../middlewaresControllers/createCRUDController');

const methods = createCRUDController('Product');

/**
 * Product is the one entity whose writes have to look at their own fields before
 * they are saved, because two of those fields carry an image that arrives inline
 * from the browser. Only those two writes are replaced here; list, read, search,
 * filter, summary and delete keep the generated implementations, and with them
 * the tenancy filter and the `removed: false` scope.
 *
 * This directory is picked up automatically - see the glob in
 * controllers/appControllers/index.js - so the generated controller is not built
 * for Product at all.
 */
methods.create = require('./create');
methods.update = require('./update');

module.exports = methods;
