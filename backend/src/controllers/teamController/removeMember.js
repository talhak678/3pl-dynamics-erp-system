const mongoose = require('mongoose');

/**
 * DELETE /api/team/:id
 *
 * Removes an employee from the calling owner's workspace.
 *
 * A soft delete, matching how the rest of this codebase removes documents:
 * `removed: true` rather than a real delete, so the invoices and quotes the
 * person raised keep a valid `createdBy` to point at.
 *
 * It ends their access immediately and without needing to touch their token.
 * `isValidAuthToken` only ever loads `{ removed: false }`, so the very next
 * request from a live session fails to find the account and is refused. The
 * stored sessions are cleared as well, so nothing is left for a token to match
 * against even if that lookup changed.
 */
const removeMember = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const notFound = () =>
    res.status(404).json({
      success: false,
      result: null,
      message: 'No member found by this id: ' + req.params.id,
    });

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return notFound();
  }

  const member = await Admin.findOneAndUpdate(
    {
      _id: req.params.id,
      parentAdminId: req.admin._id,
      removed: false,
    },
    { $set: { removed: true, isActive: false } },
    { new: true }
  ).exec();

  if (!member) {
    return notFound();
  }

  await AdminPassword.findOneAndUpdate(
    { user: member._id },
    { $set: { removed: true, loggedSessions: [] } },
    { new: true }
  ).exec();

  return res.status(200).json({
    success: true,
    result: { _id: member._id },
    message: 'User removed successfully',
  });
};

module.exports = removeMember;
