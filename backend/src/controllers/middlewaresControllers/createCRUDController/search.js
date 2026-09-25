const { scopedFilter, userFilter } = require('../../../middlewares/ownership');

const search = async (Model, req, res) => {
  // console.log(req.query.fields)
  // if (req.query.q === undefined || req.query.q.trim() === '') {
  //   return res
  //     .status(202)
  //     .json({
  //       success: false,
  //       result: [],
  //       message: 'No document found by this request',
  //     })
  //     .end();
  // }
  const fieldsArray = req.query.fields ? req.query.fields.split(',') : ['name'];

  const fields = { $or: [] };

  for (const field of fieldsArray) {
    fields.$or.push({ [field]: { $regex: new RegExp(req.query.q, 'i') } });
  }

  // `fields` is always an $or, and so are a child account's scope and the
  // owner's per-user filter. Spreading them into one object would let the last
  // one replace the others, so the account would get its whole list back
  // whatever it typed. $and holds all three, and reduces to exactly the old
  // query for anyone whose scope and filter are {} - which is the workspace
  // owner who asked for no filter, a super admin, and every unscoped model.
  //
  // The per-user clause is pushed only when there is one to push. It is empty
  // unless the caller owns the workspace AND asked for a user AND the model
  // records authorship, so it changes nothing for any request that does not.
  // No shipped caller passes `user` to this endpoint - the tables' search box
  // goes through paginatedList, which has honoured the parameter all along - so
  // this is the same clause reaching the one read path that was missing it,
  // rather than a behaviour change anyone will meet today.
  const conditions = [fields, scopedFilter(Model, req)];

  const perUser = userFilter(Model, req);

  if (Object.keys(perUser).length > 0) conditions.push(perUser);

  const results = await Model.find({
    $and: conditions,
  })
    .where('removed', false)
    .limit(20)
    .exec();

  if (results.length >= 1) {
    return res.status(200).json({
      success: true,
      result: results,
      message: 'Successfully found all documents',
    });
  } else {
    return res
      .status(202)
      .json({
        success: false,
        result: [],
        message: 'No document found by this request',
      })
      .end();
  }
};

module.exports = search;
