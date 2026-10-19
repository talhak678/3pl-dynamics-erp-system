const { isTenantOwner, ownerFilter } = require('../../../middlewares/ownership');

const { validateTarget, resolveAssignee } = require('./validateTarget');

/**
 * PATCH /api/salestarget/update/:id
 *
 * Owner-only, for the same reason create is. The stored document supplies any
 * field the request did not send, so a partial edit is validated as the target
 * it will become - changing only the end date still checks it against the
 * existing start.
 *
 * Tenancy and authorship are never writable: `createdBy` is not copied from the
 * body and `createdByUser` is never touched after creation.
 */
const update = async (Model, req, res) => {
  if (!isTenantOwner(req.admin)) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Only the workspace owner can change sales targets.',
    });
  }

  const existing = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...ownerFilter(req),
  }).exec();

  if (!existing) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  }

  const validation = validateTarget({
    title: req.body.title ?? existing.title,
    period: req.body.period ?? existing.period,
    type: req.body.type ?? existing.type,
    targetValue: req.body.targetValue ?? existing.targetValue,
    startDate: req.body.startDate ?? existing.startDate,
    endDate: req.body.endDate ?? existing.endDate,
    notes: req.body.notes ?? existing.notes,
  });

  if (!validation.ok) {
    return res.status(400).json({ success: false, result: null, message: validation.message });
  }

  let assignee = existing.assignee ?? null;

  if (Object.prototype.hasOwnProperty.call(req.body, 'assignee')) {
    const resolved = await resolveAssignee(req, req.body.assignee);

    if (!resolved.ok) {
      return res.status(403).json({ success: false, result: null, message: resolved.message });
    }

    assignee = resolved.value;
  }

  existing.set({
    ...validation.values,
    assignee,
    enabled: Object.prototype.hasOwnProperty.call(req.body, 'enabled')
      ? req.body.enabled !== false
      : existing.enabled,
    updated: new Date(),
  });

  await existing.save();

  return res.status(200).json({
    success: true,
    result: existing,
    message: 'Successfully updated the sales target',
  });
};

module.exports = update;
