const mongoose = require('mongoose');
const People = mongoose.model('People');
const Company = mongoose.model('Company');

const { migrate } = require('./migrate');
const { ownerFilter, leadFilter } = require('../../../middlewares/ownership');
const { validateAssignedTo } = require('./assignment');

const update = async (Model, req, res) => {
  // Find document by id and update with the required fields
  req.body.removed = false;
  // Ownership is immutable: never let a caller reassign a record to someone else.
  delete req.body.createdBy;
  // Authorship is immutable for the same reason. Without this a caller could
  // rewrite `createdByUser` to another account and hand themselves - or strip
  // someone else - access to a lead under the Sales Executive scope, which is
  // decided by this field.
  delete req.body.createdByUser;

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

  // validated before the write, so a reassignment to an account outside the
  // workspace is refused rather than stored and discovered later.
  if (req.body.assignedTo !== undefined) {
    const assignment = await validateAssignedTo(req, req.body.assignedTo);

    if (assignment.error) {
      return res.status(assignment.status).json({
        success: false,
        result: null,
        message: assignment.error,
      });
    }

    req.body.assignedTo = assignment.value;
  }

  const result = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
      removed: false,
      // leadFilter, not ownerFilter: an owner keeps the tenant-wide view, while a
      // Sales Executive can only reach a lead assigned to them or entered by
      // them. Scoping the lookup rather than checking after it means another
      // executive's lead is a 404 - indistinguishable from one that does not
      // exist - instead of a 403 that would confirm it is real.
      ...leadFilter(req),
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
