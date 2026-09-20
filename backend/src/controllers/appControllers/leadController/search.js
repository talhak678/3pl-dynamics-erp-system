const { migrate } = require('./migrate');
const { leadFilter } = require('../../../middlewares/ownership');

const search = async (Model, req, res) => {
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
  // console.log(fields)

  // `fields` is always an $or here, and a Sales Executive's scope is one too.
  // Spreading them together would let the scope replace the search term, so the
  // executive's search would quietly return all twenty of their leads whatever
  // they typed. $and holds both; for anyone without a scoped $or it reduces to
  // exactly the old query.
  let results = await Model.find({
    $and: [fields, leadFilter(req)],
  })
    .where('removed', false)
    .limit(20)
    .exec();

  const migratedData = results.map((x) => migrate(x));

  if (results.length >= 1) {
    return res.status(200).json({
      success: true,
      result: migratedData,
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
