const { scopedFilter } = require('../../../middlewares/ownership');

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

  // `fields` is always an $or, and so is a child account's scope. Spreading them
  // into one object would let the scope replace the search term, so the account
  // would get its whole list back whatever it typed. $and holds both, and
  // reduces to exactly the old query for anyone whose scope is {} - which is the
  // workspace owner, a super admin, and every unscoped model.
  const results = await Model.find({
    $and: [fields, scopedFilter(Model, req)],
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
