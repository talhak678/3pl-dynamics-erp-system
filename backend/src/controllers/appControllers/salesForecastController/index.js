const summary = require('./summary');

/**
 * The forecasting module.
 *
 * There is no SalesForecast model and there should not be: every figure is
 * derived from records that already exist, so a stored forecast would be a
 * second copy that goes stale the moment a lead moves. The router mounts
 * `/salesforecast/summary` explicitly in routes/appRoutes/appApi.js because the
 * automatic entity routes are generated from model filenames and this module has
 * none.
 */
module.exports = { summary: summary.summary };
