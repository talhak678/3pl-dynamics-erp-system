const mongoose = require('mongoose');

const serializeAdmin = require('./serializeAdmin');

/**
 * GET /api/superadmin/users
 *
 * Lists every admin account, including the calling super admin.
 */
const listUsers = async (req, res) => {
  const Admin = mongoose.model('Admin');

  // Projection is a second line of defence behind serializeAdmin.
  const result = await Admin.find({ removed: false })
    .select('name email enabled isActive isSuperAdmin modulePermissions created')
    .sort({ created: 1 })
    .exec();

  return res.status(200).json({
    success: true,
    result: result.map(serializeAdmin),
    message: 'Successfully found all users',
  });
};

module.exports = listUsers;
