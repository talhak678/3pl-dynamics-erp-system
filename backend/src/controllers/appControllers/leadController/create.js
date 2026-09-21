const mongoose = require('mongoose');
const People = mongoose.model('People');
const Company = mongoose.model('Company');

const { ownerFilter } = require('../../../middlewares/ownership');
const { validateAssignedTo, canChooseAssignee } = require('./assignment');

const create = async (Model, req, res) => {
  // Creating a new document in the collection

  if (req.body.type === 'people') {
    if (!req.body.people) {
      return res.status(403).json({
        success: false,
        message: 'Please select a people',
      });
    } else {
      let { firstname, lastname } = await People.findOne({
        _id: req.body.people,
        removed: false,
        ...ownerFilter(req),
      }).exec();
      req.body.name = firstname + ' ' + lastname;
      req.body.company = null;
    }
  } else {
    if (!req.body.company) {
      return res.status(403).json({
        success: false,
        message: 'Please select a company',
      });
    } else {
      let { name } = await Company.findOne({
        _id: req.body.company,
        removed: false,
        ...ownerFilter(req),
      }).exec();
      req.body.name = name;
      req.body.people = null;
    }
  }

  req.body.removed = false;
  req.body.createdBy = req.admin.tenantId;

  // Authorship, which is a different question from ownership. `createdBy` is the
  // tenant that holds the lead; this is the account that actually entered it,
  // and it is what the Sales Executive scope matches on. Assigned here rather
  // than read from the body, so the same request cannot claim to be someone
  // else's work, and set before the spread below so it always wins.
  req.body.createdByUser = req.admin._id;

  // An id from the client is not evidence the account exists, still less that it
  // belongs to this workspace - so it is resolved and checked before it is
  // written.
  //
  // A Sales Executive does not get to name one at all: their leads are theirs,
  // because that is what their read scope is defined in terms of. The requested
  // value is replaced before validation rather than after, so their own id goes
  // through exactly the same workspace check as an owner's choice would - one
  // code path, and no id written that the check has not seen.
  const requestedAssignee = canChooseAssignee(req) ? req.body.assignedTo : req.admin._id;

  const assignment = await validateAssignedTo(req, requestedAssignee);

  if (assignment.error) {
    return res.status(assignment.status).json({
      success: false,
      result: null,
      message: assignment.error,
    });
  }

  // Deleted rather than set to undefined when unassigned, so an unassigned lead
  // carries no field at all instead of a null the pipeline would have to treat
  // as a second kind of empty.
  if (assignment.value === undefined) {
    delete req.body.assignedTo;
  } else {
    req.body.assignedTo = assignment.value;
  }

  const result = await new Model({
    ...req.body,
  }).save();

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully Created the document in Model ',
  });
};

module.exports = create;
