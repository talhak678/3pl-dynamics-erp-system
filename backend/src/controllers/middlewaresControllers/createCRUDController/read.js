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
  //
  // No date window applies here either, and that is deliberate: the caller
  // already holds the id, so opening a record is not a question about a period.
  // A row opened from a table must stay openable after the header's window
  // moves, or the panel's own re-fetch would 404 on the record it is showing.
  const query = Model.findOne({
    _id: req.params.id,
    removed: false,
    ...scopedFilter(Model, req),
  });

  const result = await query.exec();

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
