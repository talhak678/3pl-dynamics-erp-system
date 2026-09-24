const mongoose = require('mongoose');

const { tenantIdOf, isTenantOwner, ASSIGNEE_FIELD } = require('../middlewares/ownership');

/**
 * The `assignedTo` write path, shared by every entity that now records an
 * assignee.
 *
 * Generalised from leadController/assignment.js, which had the same job for one
 * model. The two are kept separate on purpose: that file's rules are shaped by
 * the Sales Pipeline - an executive's leads are theirs whether or not they name
 * an assignee - and folding this broader rule into it would change lead
 * behaviour that was specified and tested on its own terms.
 *
 * What this adds is the rule the other ten entities work by: the workspace owner
 * may hand a record to anyone on the team, and nobody else may choose at all.
 *
 * The requirement is that only the Customer Admin can delegate. Ignoring the
 * field for everyone else - rather than refusing the request with a 403 - is
 * deliberate, and follows the same reasoning the lead controller already uses:
 * the control is not rendered for those accounts, so a value arriving here is a
 * hand-made request rather than a misclick, and the useful answer is a record
 * that saves and belongs to its author, not an error to decode. Nothing is
 * widened by dropping it: a child account's own record reaches them through
 * createdByUser, which is why they never needed the field in the first place.
 */

/**
 * Resolves a submitted assignee, checking it is an account in the caller's
 * workspace.
 *
 * Without this the field is a free-form ObjectId the client controls, and an
 * owner could point a record at an account in another tenant - a cross-tenant
 * reference created from inside one workspace, which is exactly the class of
 * link the rest of this app is built to make impossible.
 *
 * Comparing tenants rather than checking `parentAdminId === req.admin._id` makes
 * the check read the same for an owner assigning to themselves and to a team
 * member: every account of a workspace resolves to the same tenant id.
 *
 * Returns `{ value }` or `{ error, status }`, matching the shape roles.js and
 * permissions.js use. Async because an id the caller supplied is not evidence
 * the account exists.
 */
const validateAssignedTo = async (req, value) => {
  // Absent or explicitly cleared both mean "nobody is on this record".
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
 * Applies the rules above to a create or update body, in place.
 *
 * Returns `{ ok: true }` when the request may proceed - including when there was
 * nothing to do - or `{ ok: false, error, status }` when the caller named an id
 * that must not be written.
 *
 * Three things are settled here, and the order matters:
 *
 *  1. A model with no `assignedTo` path is left completely alone. Assigning to a
 *     path Mongoose does not know about is dropped silently in strict mode, which
 *     would look like a successful assignment that never happened.
 *  2. A caller who is not the workspace owner has the field removed rather than
 *     rewritten. Removing it leaves an existing assignee untouched on update and
 *     leaves the field absent on create - whereas setting it to the caller's own
 *     id would silently reassign a colleague's record to whoever edited it last.
 *  3. Only then is a value the owner actually sent resolved against the team
 *     list. A body that never mentioned the field costs no database round trip,
 *     so the common case - every non-owner write, and every owner write that is
 *     not a delegation - is free.
 */
const applyAssignedTo = async (Model, req) => {
  if (!Model || !Model.schema || !Model.schema.path(ASSIGNEE_FIELD)) return { ok: true };

  if (!isTenantOwner(req && req.admin)) {
    delete req.body[ASSIGNEE_FIELD];
    return { ok: true };
  }

  if (!Object.prototype.hasOwnProperty.call(req.body, ASSIGNEE_FIELD)) return { ok: true };

  const assignment = await validateAssignedTo(req, req.body[ASSIGNEE_FIELD]);

  if (assignment.error) {
    return { ok: false, error: assignment.error, status: assignment.status };
  }

  // Deleted rather than set to undefined when cleared, so an unassigned record
  // carries no field at all instead of a null the pipeline would have to treat
  // as a second kind of empty.
  if (assignment.value === undefined) {
    delete req.body[ASSIGNEE_FIELD];
  } else {
    req.body[ASSIGNEE_FIELD] = assignment.value;
  }

  return { ok: true };
};

/**
 * Authorship is immutable, on every entity that records it.
 *
 * The tenant field is already stripped on update for the same reason; this is
 * the same rule for the second field, and it matters more now that the field
 * decides what an account can see. Left writable, a child account could send
 * `createdByUser` naming a colleague and hand away the only claim it has on the
 * record - or, on a model it does not own, claim work it never did.
 *
 * Deleted rather than validated, because there is no value the client could
 * legitimately send: authorship is set once, by the server, from the session.
 */
const stripAuthorship = (req) => {
  delete req.body.createdByUser;
};

module.exports = { validateAssignedTo, applyAssignedTo, stripAuthorship };
