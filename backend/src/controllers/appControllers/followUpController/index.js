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
 *   listAll               the generic one applies no date window and no
 *                         lead/client/status filters
 *
 * `list` is left generic: it is the paginated endpoint, which already applies
 * scopedFilter and, now that FollowUp is in DATED_MODELS, the header window.
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
