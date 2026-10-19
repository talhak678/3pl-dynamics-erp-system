const { applyAssignedTo } = require('../../../utils/assignee');

const { resolveLink, parseDate } = require('./resolveLink');
const syncLeadFollowUp = require('./syncLeadFollowUp');

/**
 * POST /api/followup/create
 *
 * The one way a follow-up is created, from either screen - the Sales Follow-ups
 * module or the pipeline card's quick action. Keeping the write in one place is
 * what makes the two views a single dataset; a second endpoint for the board
 * would be a second chance for the lead's cached date to fall out of step.
 *
 * Fields are picked rather than spread from the body, so a caller cannot set
 * `createdBy` (tenancy), `createdByUser` (authorship), `removed`, or timestamps.
 * The shared controller's create does the same thing through a body rewrite;
 * this one is explicit because it also validates the link and then has to sync
 * the lead afterwards.
 */
const create = async (Model, req, res) => {
  const link = await resolveLink(req, req.body);

  if (!link.ok) {
    return res.status(link.status).json({
      success: false,
      result: null,
      message: link.message,
    });
  }

  const date = parseDate(req.body.date);

  if (!date) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'A due date is required for a follow-up.',
    });
  }

  // Delegation, where the model records an assignee: only the workspace owner
  // may name one, and the account must belong to this workspace. See
  // utils/assignee.js.
  const assignment = await applyAssignedTo(Model, req);

  if (!assignment.ok) {
    return res.status(assignment.status).json({
      success: false,
      result: null,
      message: assignment.error,
    });
  }

  const completed = req.body.completed === true;

  const document = new Model({
    removed: false,
    enabled: req.body.enabled !== false,

    createdBy: req.admin.tenantId,
    createdByUser: req.admin._id,
    // `applyAssignedTo` has already removed a delegation the caller may not make.
    // Falling back to the lead's assignee is what lets the rep the lead belongs
    // to see a follow-up an owner scheduled - see resolveLink.
    assignedTo: req.body.assignedTo || link.leadAssignee,

    lead: link.lead,
    client: link.client,

    subject: req.body.subject,
    notes: req.body.notes,
    channel: req.body.channel || 'Call',
    date,

    completed,
    completedAt: completed ? new Date() : undefined,
    outcome: req.body.outcome,

    created: new Date(),
    updated: new Date(),
  });

  const saved = await document.save();

  // The board reads the lead, so the cached date is updated before the response
  // is sent. A follow-up is never "saved" without the board agreeing it exists.
  await syncLeadFollowUp(link.lead, req.admin.tenantId);

  // Re-read so mongoose-autopopulate fills the lead/client it was just linked
  // to. A save() result is the raw document, and the module renders the lead's
  // name and stage straight away.
  const result = await Model.findById(saved._id).exec();

  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully scheduled the follow-up',
  });
};

module.exports = create;
