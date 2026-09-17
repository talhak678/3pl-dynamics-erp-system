const mongoose = require('mongoose');

const serializeMember = require('./serializeMember');

/**
 * GET /api/team/:id
 *
 * A single employee, for the edit form.
 *
 * The owner filter is part of the lookup rather than a check afterwards, so an
 * id belonging to another workspace is indistinguishable from an id that does
 * not exist - both are a 404. Returning 403 for one and 404 for the other would
 * confirm which ids are real accounts on this deployment.
 */
const readMember = async (req, res) => {
  const Admin = mongoose.model('Admin');

  const notFound = () =>
    res.status(404).json({
      success: false,
      result: null,
      message: 'No member found by this id: ' + req.params.id,
    });

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return notFound();
  }

  const member = await Admin.findOne({
    _id: req.params.id,
    parentAdminId: req.admin._id,
    removed: false,
  })
    .select('name surname email photo role isActive modulePermissions created')
    .exec();

  if (!member) {
    return notFound();
  }

  return res.status(200).json({
    success: true,
    result: serializeMember(member),
    message: 'Successfully found the team member',
  });
};

module.exports = readMember;
