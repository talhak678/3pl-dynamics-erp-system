const mongoose = require('mongoose');

const createCRUDController = require('../../middlewaresControllers/createCRUDController');

const create = require('./create');
const update = require('./update');
const remove = require('./remove');
const listAll = require('./listAll');

/**
 * The follow-up CRUD surface.
 *
 * The generic controller covers read, search, filter, list and summary. The five
 * that are overridden are overridden for one reason each:
 *
 *   create/update/delete  they own the lead resync, which is what keeps the
 *                         pipeline board's cached `followUpDate` correct
 *   update/delete         the generic versions ignore the link validation
 *   listAll               the generic one applies no lead/client/status filters
 *                         and, more importantly, no backfill from leads that
 *                         are in the Follow-Up stage
 *
 * `list` is left generic. It is the paginated endpoint and applies the same
 * tenant scope; it is not the endpoint this module uses, and FollowUp is
 * deliberately outside the global date window (see utils/dateRange.js).
 */
function modelController() {
  const modelName = 'FollowUp';
  const Model = mongoose.model(modelName);

  const methods = createCRUDController(modelName);

  methods.create = (req, res) => create(Model, req, res);
  methods.update = (req, res) => update(Model, req, res);
  methods.delete = (req, res) => remove(Model, req, res);
  methods.listAll = (req, res) => listAll(Model, req, res);

  return methods;
}

module.exports = modelController();
