const { scopedFilter } = require('../../../middlewares/ownership');

const syncLeadFollowUp = require('./syncLeadFollowUp');

/**
 * DELETE /api/followup/delete/:id
 *
 * A soft delete, like every other record in the app. The lead is resynced after
 * it, because deleting the earliest pending follow-up should move the board's
 * cached date to the next one - or clear it when that was the last.
 */
const remove = async (Model, req, res) => {
  const result = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
      removed: false,
      ...scopedFilter(Model, req),
    },
    {
      $set: {
        removed: true,
        updated: new Date(),
      },
    },
    {
      new: true,
    }
  ).exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  }

  await syncLeadFollowUp(result.lead, req.admin.tenantId);

  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully deleted the follow-up',
  });
};

module.exports = remove;
