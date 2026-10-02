const { scopedFilter } = require('../../../middlewares/ownership');

/**
 * Whether this model records who a record is assigned to, and may be populated.
 *
 * Mongoose's strictPopulate throws when asked to populate a path that is not in
 * the schema, and this controller is shared by every entity with no read of its
 * own - Product, Taxes, PaymentMode and Setting among them, none of which have
 * an assignee. Asking only where the path exists keeps one controller working
 * for all of them, and is why this cannot simply be
 * `.populate('assignedTo', 'name')`.
 *
 * `ref` is the test rather than the path name, because a path called
 * `assignedTo` that is not a reference would resolve to nothing useful anyway.
 *
 * `assignedTo` alone, and deliberately not `createdBy`/`createdByUser`. Those
 * exist on almost every model, so including them would populate nearly every
 * read response - and `dataForRead` pushes every field it is given to the read
 * view, so a field no screen renders today would start arriving as an object on
 * screens this change was never asked to touch. Only the field the brief is
 * about is resolved.
 */
const hasAssigneeRef = (Model) => Boolean(Model.schema.path('assignedTo')?.options?.ref);

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

  if (hasAssigneeRef(Model)) {
    query.populate('assignedTo', 'name');
  }

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
