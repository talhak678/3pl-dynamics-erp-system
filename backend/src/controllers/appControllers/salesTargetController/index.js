const mongoose = require('mongoose');

const createCRUDController = require('../../middlewaresControllers/createCRUDController');

const create = require('./create');
const update = require('./update');
const remove = require('./remove');
const listAll = require('./listAll');

/**
 * The sales-target CRUD surface.
 *
 * create, update and delete are replaced because each is owner-only and
 * validates the period and assignee; listAll is replaced because the achieved
 * figure does not exist on the document and has to be computed on read.
 *
 * The remaining generic methods are reached only through the paths this module
 * actually uses. `list` is left as-is; if anything ever paginates targets it
 * will not carry the computed figures, which is why the module uses listAll.
 */
function modelController() {
  const modelName = 'SalesTarget';
  const Model = mongoose.model(modelName);

  const methods = createCRUDController(modelName);

  methods.create = (req, res) => create(Model, req, res);
  methods.update = (req, res) => update(Model, req, res);
  methods.delete = (req, res) => remove(Model, req, res);
  methods.listAll = (req, res) => listAll(Model, req, res);

  return methods;
}

module.exports = modelController();
