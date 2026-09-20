const { migrate } = require('./migrate');
const { leadFilter } = require('../../../middlewares/ownership');

const paginatedList = async (Model, req, res) => {
  const page = req.query.page || 1;

  const limit = parseInt(req.query.items) || 10;
  const skip = page * limit - limit;

  const { sortBy = 'enabled', sortValue = -1, filter, equal } = req.query;

  const fieldsArray = req.query.fields ? req.query.fields.split(',') : [];

  let fields;

  fields = fieldsArray.length === 0 ? {} : { $or: [] };

  for (const field of fieldsArray) {
    fields.$or.push({ [field]: { $regex: new RegExp(req.query.q, 'i') } });
  }

  // A Sales Executive's scope is itself an $or, and a text search builds one
  // too. Spreading both into a single object would let whichever came last
  // replace the other - the search would be dropped, and the caller would be
  // handed every lead they can see. That reads as "search is broken", but it is
  // the scope quietly swallowing the query. $and keeps both, and is equivalent
  // to the plain spread when only one of them is present.
  const conditions = [{ removed: false }];

  if (filter !== undefined) conditions.push({ [filter]: equal });
  if (fields.$or) conditions.push(fields);
  conditions.push(leadFilter(req));

  const query = { $and: conditions };

  //  Query the database for a list of all results
  const resultsPromise = Model.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortValue })
    .populate()
    .exec();

  // Counting the total documents
  const countPromise = Model.countDocuments(query);
  // Resolving both promises
  const [result, count] = await Promise.all([resultsPromise, countPromise]);
  // console.log('🚀 ~ file: paginatedList.js:23 ~ paginatedList ~ result:', result);

  // Calculating total pages
  const pages = Math.ceil(count / limit);

  const pagination = { page, pages, count };
  if (count > 0) {
    const migratedData = result.map((x) => migrate(x));
    // console.log('🚀 ~ file: paginatedList.js:23 ~ paginatedList ~ migratedData:', migratedData);
    return res.status(200).json({
      success: true,
      result: migratedData,
      pagination,
      message: 'Successfully found all documents',
    });
  } else {
    return res.status(203).json({
      success: true,
      result: [],
      pagination,
      message: 'Collection is Empty',
    });
  }
};

module.exports = paginatedList;
