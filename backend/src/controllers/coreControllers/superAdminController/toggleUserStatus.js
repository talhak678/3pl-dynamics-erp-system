const mongoose = require('mongoose');

const serializeAdmin = require('./serializeAdmin');

/**
 * PATCH /api/superadmin/users/:id/status
 *
 * Suspends or reactivates an account. Because isValidAuthToken checks isActive
 * per request, a suspension takes effect on the tenant's next request rather
 * than whenever their token happens to expire.
 */
const toggleUserStatus = async (req, res) => {
  const Admin = mongoose.model('Admin');

  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'isActive must be a boolean',
    });
  }

  // A super admin must not be able to lock itself out of the control plane.
  // This single guard is also what guarantees at least one active super admin
  // always remains: after any sequence of suspensions, the last actor cannot
  // suspend itself.
  if (req.params.id === req.admin._id.toString()) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'You cannot change the status of your own account',
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
    { $set: { isActive } },
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
    message: isActive ? 'Account activated successfully' : 'Account suspended successfully',
  });
};

module.exports = toggleUserStatus;
