const mongoose = require('mongoose');

const serializeWorkspace = require('./serializeWorkspace');

/**
 * GET /api/superadmin/workspaces
 *
 * Lists workspaces, newest first. Soft-deleted rows are never returned.
 *
 * `?activeOnly=true` narrows the list to active workspaces, which is what the
 * Create User form's dropdown asks for: an inactive workspace must not be
 * selectable for a new account, but it still has to appear in Workspace
 * Management so it can be switched back on.
 *
 * The list is unpaginated on purpose. It is a control-plane list of customer
 * accounts, so it grows with the number of customers rather than with business
 * volume, and the whole of it is needed at once for the client-side search and
 * for the dropdown.
 */
const listWorkspaces = async (req, res) => {
  const Workspace = mongoose.model('Workspace');

  const filter = { removed: false };

  if (req.query.activeOnly === 'true') {
    filter.isActive = true;
  }

  const result = await Workspace.find(filter).sort({ created: -1 }).exec();

  return res.status(200).json({
    success: true,
    result: result.map(serializeWorkspace),
    message: 'Successfully found all workspaces',
  });
};

module.exports = listWorkspaces;
