const mongoose = require('mongoose');

const { isValidModuleKey } = require('../../../utils/moduleList');
const serializeAdmin = require('./serializeAdmin');
const clampChildren = require('./clampChildren');

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

  // Narrowing a tenant owner's modules has to reach their employees, who were
  // only ever validated against the owner's grants as they stood at the time.
  // The write above has already committed, so this is best effort by design -
  // clampChildren swallows its own errors rather than failing the request that
  // has in fact succeeded.
  const cascaded = await clampChildren(result._id, modulePermissions);

  return res.status(200).json({
    success: true,
    result: serializeAdmin(result),
    message: 'User permissions updated successfully',
    // Reported so the caller can tell the difference between "this owner lost
    // some modules" and "and it cost three employees their access".
    cascadedToEmployees: cascaded,
  });
};

module.exports = updateUserPermissions;
