const mongoose = require('mongoose');

const { tenantIdOf, isSalesExecutive } = require('../../../middlewares/ownership');

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
 * deliberate, so the check reads the same for both callers: every account of a
 * workspace - the owner's own record, and every employee's - resolves to the
 * same tenant id, so an owner may assign to themselves or to anyone on their
 * team, and the check needs no branch for which of the two is asking.
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

/**
 * Whether this request gets to choose who a lead belongs to.
 *
 * A Sales Executive does not, and that is the whole of their assignment rule:
 * the leads they enter are theirs, because the narrowed scope they read through
 * (see leadFilter) is defined in terms of `assignedTo` and `createdByUser`. A
 * lead they created and left pointed at nobody would be one they could not find
 * again the moment they navigated away from it.
 *
 * So creation ignores the body and assigns to the caller, and an update drops
 * the field entirely rather than re-pointing it - an executive editing a lead
 * keeps whatever assignee it already had, which is what the hidden form field
 * would have produced anyway.
 *
 * Refusing with a 403 was the alternative. It was rejected because the field is
 * not rendered for these accounts at all, so a value arriving here is a
 * hand-made request rather than a misclick, and the useful answer to "assign
 * this to a colleague" is a lead that exists and belongs to its author - not an
 * error the caller has to decode. Nothing is widened by the override: the value
 * written is the caller's own id, which they could always have written.
 *
 * Note this is a separate question from validateAssignedTo, and is asked before
 * it. Once this has run, the id reaching that function is always one the caller
 * was entitled to name - so its workspace check is a backstop rather than the
 * place the rule lives.
 *
 * Everyone else chooses freely, owners included. `role` is a job title
 * everywhere else in this codebase and nothing branches on it but this.
 */
const canChooseAssignee = (req) => !isSalesExecutive(req && req.admin);

module.exports = { validateAssignedTo, canChooseAssignee };
