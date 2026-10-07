const mongoose = require('mongoose');

const serializeWorkspace = require('./serializeWorkspace');

/**
 * PATCH /api/superadmin/workspaces/:id/status
 *
 * Activates or deactivates a workspace, mirroring toggleUserStatus.
 *
 * Deactivating does NOT cascade to the accounts already on the workspace. It
 * only removes the workspace from the Create User dropdown, which is what stops
 * new accounts being provisioned against a customer who has left. Suspending
 * their existing users is a separate, deliberate act - doing it here would make
 * one checkbox silently lock out a whole customer.
 *
 * `isActive` must be a real boolean, not a truthy string. Without that check
 * the string "false" would activate a workspace, which is the exact opposite of
 * what was asked for.
 */
const updateWorkspaceStatus = async (req, res) => {
  const Workspace = mongoose.model('Workspace');

  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'isActive must be a boolean',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No workspace found by this id: ' + req.params.id,
    });
  }

  const result = await Workspace.findOneAndUpdate(
    { _id: req.params.id, removed: false },
    { $set: { isActive, updated: Date.now() } },
    {
      new: true,
      runValidators: true,
    }
  ).exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No workspace found by this id: ' + req.params.id,
    });
  }

  return res.status(200).json({
    success: true,
    result: serializeWorkspace(result),
    message: isActive ? 'Workspace activated successfully' : 'Workspace deactivated successfully',
  });
};

module.exports = updateWorkspaceStatus;
