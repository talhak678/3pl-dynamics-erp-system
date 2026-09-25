const { scopedFilter } = require('../../../middlewares/ownership');

const read = async (Model, req, res) => {
  // Find document by id
  //
  // The scope, but deliberately not userFilter. This fetches ONE record the
  // caller already has the id of, so applying the owner's per-user filter here
  // would not hide a list - it would answer "no such document" for a record the
  // admin can legitimately open, turning a filter into a 404 the moment they
  // clicked a row in their own filtered table. The list and search endpoints
  // honour ?user= because they decide what to show; this one decides whether a
  // thing the caller is entitled to see exists at all, which is a different
  // question and not one a view preference should answer.
  const result = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...scopedFilter(Model, req),
  }).exec();
  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    // Return success resposne
    return res.status(200).json({
      success: true,
      result,
      message: 'we found this document ',
    });
  }
};

module.exports = read;
