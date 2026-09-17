const mongoose = require('mongoose');

const serializeMember = require('./serializeMember');

/**
 * GET /api/team
 *
 * The employees belonging to the calling owner's workspace.
 *
 * Scoped by `parentAdminId` rather than by the tenant id, because this route is
 * behind requireTenantOwner: the caller is always an owner, so their own id IS
 * their tenant id, and matching on it directly says exactly what is meant -
 * the accounts this owner created. An employee reaching this would list their
 * colleagues; the gate is what stops that, and this filter is the second line.
 */
const listTeam = async (req, res) => {
  const Admin = mongoose.model('Admin');

  const result = await Admin.find({ parentAdminId: req.admin._id, removed: false })
    .select('name surname email photo role isActive modulePermissions created')
    .sort({ created: 1 })
    .exec();

  return res.status(200).json({
    success: true,
    result: result.map(serializeMember),
    message: 'Successfully found all team members',
  });
};

module.exports = listTeam;
