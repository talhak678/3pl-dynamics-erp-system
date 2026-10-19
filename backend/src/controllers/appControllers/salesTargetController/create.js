const { isTenantOwner } = require('../../../middlewares/ownership');

const { validateTarget, resolveAssignee } = require('./validateTarget');

/**
 * POST /api/salestarget/create
 *
 * Owner-only: a target is a workspace-level commitment the Customer Admin
 * publishes, not something every account granted the module may invent. The
 * check is repeated on update and delete; the UI hides those controls for
 * everyone else, and this is the half that makes the hiding true.
 *
 * The assignee is resolved against the workspace before it is written, and a
 * target with no assignee is company-wide.
 */
const create = async (Model, req, res) => {
  if (!isTenantOwner(req.admin)) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Only the workspace owner can create sales targets.',
    });
  }

  const validation = validateTarget(req.body);

  if (!validation.ok) {
    return res.status(400).json({ success: false, result: null, message: validation.message });
  }

  const assignee = await resolveAssignee(req, req.body.assignee);

  if (!assignee.ok) {
    return res.status(403).json({ success: false, result: null, message: assignee.message });
  }

  const document = new Model({
    removed: false,
    enabled: req.body.enabled !== false,

    createdBy: req.admin.tenantId,
    createdByUser: req.admin._id,

    ...validation.values,
    assignee: assignee.value,

    created: new Date(),
    updated: new Date(),
  });

  const saved = await document.save();

  return res.status(200).json({
    success: true,
    result: saved,
    message: 'Successfully created the sales target',
  });
};

module.exports = create;
