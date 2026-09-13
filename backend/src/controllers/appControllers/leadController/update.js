const mongoose = require('mongoose');
const People = mongoose.model('People');
const Company = mongoose.model('Company');

const { migrate } = require('./migrate');
const { ownerFilter } = require('../../../middlewares/ownership');

const update = async (Model, req, res) => {
  // Find document by id and update with the required fields
  req.body.removed = false;
  // Ownership is immutable: never let a caller reassign a record to someone else.
  delete req.body.createdBy;

  // If type changed, re-resolve the name
  if (req.body.type === 'people' && req.body.people) {
    let person = await People.findOne({
      _id: req.body.people,
      removed: false,
      ...ownerFilter(req),
    }).exec();
    if (person) {
      req.body.name = person.firstname + ' ' + person.lastname;
      req.body.company = null;
    }
  } else if (req.body.type === 'company' && req.body.company) {
    let company = await Company.findOne({
      _id: req.body.company,
      removed: false,
      ...ownerFilter(req),
    }).exec();
    if (company) {
      req.body.name = company.name;
      req.body.people = null;
    }
  }

  const result = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
      removed: false,
      ...ownerFilter(req),
    },
    req.body,
    {
      new: true,
      runValidators: true,
    }
  ).exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    const migratedData = migrate(result);
    return res.status(200).json({
      success: true,
      result: migratedData,
      message: 'we update this document ',
    });
  }
};

module.exports = update;
