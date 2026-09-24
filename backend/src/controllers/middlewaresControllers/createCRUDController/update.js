const { scopedFilter } = require('../../../middlewares/ownership');
const { applyAssignedTo, stripAuthorship } = require('../../../utils/assignee');

const update = async (Model, req, res) => {
  // Find document by id and updates with the required fields
  req.body.removed = false;
  // Ownership is immutable: never let a caller reassign a record to someone else.
  delete req.body.createdBy;
  // Nor is authorship editable. The field decides what an account can see, so a
  // writable one would let a child account hand away its own record - or claim
  // one it never wrote. See utils/assignee.js.
  stripAuthorship(req);

  // Delegation. Only the workspace owner may change it; for everyone else the
  // field is dropped from the body, which leaves whatever assignee the record
  // already had rather than clearing it.
  const assignment = await applyAssignedTo(Model, req);

  if (!assignment.ok) {
    return res.status(assignment.status).json({
      success: false,
      result: null,
      message: assignment.error,
    });
  }

  const result = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
      removed: false,
      ...scopedFilter(Model, req),
    },
    req.body,
    {
      new: true, // return the new result instead of the old one
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
    return res.status(200).json({
      success: true,
      result,
      message: 'we update this document ',
    });
  }
};

module.exports = update;
