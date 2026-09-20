const mongoose = require('mongoose');
const createCRUDController = require('../../middlewaresControllers/createCRUDController');
const remove = require('./remove');
const summary = require('./summary');

const create = require('./create');
const update = require('./update');
const read = require('./read');
const search = require('./search');

const listAll = require('./listAll');
const paginatedList = require('./paginatedList');
const filter = require('./filter');

function modelController() {
  const modelName = 'Lead';
  const Model = mongoose.model(modelName);
  const methods = createCRUDController(modelName);
  methods.read = (req, res) => read(Model, req, res);
  methods.delete = (req, res) => remove(Model, req, res);
  methods.list = (req, res) => paginatedList(Model, req, res);
  methods.summary = (req, res) => summary(Model, req, res);
  methods.create = (req, res) => create(Model, req, res);
  methods.update = (req, res) => update(Model, req, res);
  methods.search = (req, res) => search(Model, req, res);
  methods.listAll = (req, res) => listAll(Model, req, res);
  // Overridden so the pipeline scope applies here too - the one read path the
  // generic controller would otherwise serve tenant-wide.
  methods.filter = (req, res) => filter(Model, req, res);
  return methods;
}

module.exports = modelController();
