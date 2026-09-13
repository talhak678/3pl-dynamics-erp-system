const mongoose = require('mongoose');

const { isValidModuleKey } = require('../../../utils/moduleList');
const serializeAdmin = require('./serializeAdmin');

/**
 * PATCH /api/superadmin/users/:id/permissions
 *
 * Replaces an account's module allow-list. An empty array restores access to
 * every module.
 */
const updateUserPermissions = async (req, res) => {
  const Admin = mongoose.model('Admin');

  const { modulePermissions } = req.body;

  if (!Array.isArray(modulePermissions)) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'modulePermissions must be an array of module keys',
    });
  }

  // Reject the whole request rather than writing a partial list.
  const unknownModules = modulePermissions.filter((key) => !isValidModuleKey(key));

  if (unknownModules.length > 0) {
    return res.status(400).json({
      success: false,
      result: null,
      message: `Unknown module key(s): ${unknownModules.join(', ')}`,
    });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No account found by this id: ' + req.params.id,
    });
  }

  const result = await Admin.findOneAndUpdate(
    { _id: req.params.id, removed: false },
    { $set: { modulePermissions } },
    {
      new: true,
      runValidators: true,
    }
  ).exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No account found by this id: ' + req.params.id,
    });
  }

  return res.status(200).json({
    success: true,
    result: serializeAdmin(result),
    message: 'User permissions updated successfully',
  });
};

module.exports = updateUserPermissions;
