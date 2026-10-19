const { isTenantOwner, ownerFilter } = require('../../../middlewares/ownership');

/**
 * DELETE /api/salestarget/delete/:id
 *
 * Soft delete, owner-only. The target's progress is derived and never stored, so
 * removing the target removes its figures with it and leaves the underlying
 * invoices, orders and leads untouched.
 */
const remove = async (Model, req, res) => {
  if (!isTenantOwner(req.admin)) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Only the workspace owner can remove sales targets.',
    });
  }

  const result = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
      removed: false,
      ...ownerFilter(req),
    },
    {
      $set: {
        removed: true,
        updated: new Date(),
      },
    },
    { new: true }
  ).exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  }

  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully removed the sales target',
  });
};

module.exports = remove;
