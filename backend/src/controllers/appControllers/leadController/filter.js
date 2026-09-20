const { leadFilter, isReservedFilterKey } = require('../../../middlewares/ownership');

/**
 * GET /api/lead/filter
 *
 * The generic createCRUDController filter, but scoped through leadFilter.
 *
 * A near-copy rather than a call into the shared one, because the scope is the
 * only thing that differs and the generic version hardcodes ownerFilter. The
 * alternative - teaching the generic filter to take a scope resolver and
 * threading it through every entity - would change the shape of a controller
 * that nine other models depend on, to serve one of them.
 *
 * This override is not optional. leadController/index.js overrides every other
 * read path, but `filter` was left on the generic implementation, so without
 * this file an executive could call /api/lead/filter and page through the whole
 * workspace's leads - the exact view the pipeline scope exists to deny, reached
 * through the one endpoint nobody re-pointed.
 */
const filter = async (Model, req, res) => {
  if (req.query.filter === undefined || req.query.equal === undefined) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'filter not provided correctly',
    });
  }

  // The .where() builder would override the scope clause, so it is refused
  // rather than merged - same reason as the generic implementation.
  if (isReservedFilterKey(req.query.filter)) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'filter not provided correctly',
    });
  }

  const result = await Model.find({
    removed: false,
    ...leadFilter(req),
  })
    .where(req.query.filter)
    .equals(req.query.equal)
    .exec();

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
    message: 'Successfully found all documents  ',
  });
};

module.exports = filter;
