const mongoose = require('mongoose');

const serializeAdmin = require('./serializeAdmin');

/**
 * GET /api/superadmin/users
 *
 * Lists every admin account, including the calling super admin.
 *
 * The workspace is populated so the list can name it rather than showing an
 * id. serializeAdmin handles a populated path and a bare id alike, so the
 * population here is presentation only and nothing downstream depends on it -
 * which is what keeps a row whose workspace was deleted, and therefore does not
 * populate, from breaking the payload.
 */
const listUsers = async (req, res) => {
  const Admin = mongoose.model('Admin');

  // Projection is a second line of defence behind serializeAdmin.
  const result = await Admin.find({ removed: false })
    .select('name email enabled isActive isSuperAdmin modulePermissions workspace created')
    .populate('workspace', 'code name')
    .sort({ created: 1 })
    .exec();

  return res.status(200).json({
    success: true,
    result: result.map(serializeAdmin),
    message: 'Successfully found all users',
  });
};

module.exports = listUsers;
