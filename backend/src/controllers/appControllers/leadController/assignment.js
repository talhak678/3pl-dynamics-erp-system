const mongoose = require('mongoose');

const { tenantIdOf } = require('../../../middlewares/ownership');

/**
 * Validates an `assignedTo` submitted with a lead.
 *
 * The rule is that the assignee must already belong to the caller's workspace.
 * Without it, `assignedTo` is a free-form ObjectId the client controls, and an
 * owner could point a lead at an account in another tenant - a cross-tenant
 * reference created from inside one workspace, which is exactly the class of
 * link the rest of this app is built to make impossible.
 *
 * Comparing tenants rather than checking `parentAdminId === req.admin._id` is
 * deliberate, so the check reads the same for both callers:
 *
 *   - for an owner, their own record and every employee resolve to their id, so
 *     they may assign to themselves or to anyone on their team;
 *   - for a Sales Executive, the same comparison resolves to their employer, so
 *     they may assign to a colleague but never outside the workspace.
 *
 * A super admin resolves to their own id and so fails this test for every
 * tenant, which is the desired outcome: control-plane accounts own no tenant
 * data and must never be the target of a tenant's assignment.
 *
 * Returns `{ value }` or `{ error, status }`, the shape permissions.js and
 * roles.js use, so all three read alike at the call site. Async because it
 * resolves the assignee from the database - an id the caller supplied is not
 * evidence that the account exists.
 */
const validateAssignedTo = async (req, value) => {
  // Absent or explicitly cleared both mean "nobody is on this lead".
  if (value === undefined) return { value: undefined };
  if (value === null || value === '') return { value: null };

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return { error: 'assignedTo must be a valid user id', status: 400 };
  }

  const Admin = mongoose.model('Admin');

  // `removed: false` so a soft-deleted account cannot be assigned work it can
  // no longer sign in to see.
  const assignee = await Admin.findOne({ _id: value, removed: false }).exec();

  // One message for "no such account" and "not in your workspace" alike, so the
  // response cannot be used to probe which ids exist.
  if (!assignee || String(tenantIdOf(assignee)) !== String(tenantIdOf(req.admin))) {
    return {
      error: 'That user is not part of your workspace.',
      status: 403,
    };
  }

  return { value: assignee._id };
};

module.exports = { validateAssignedTo };
