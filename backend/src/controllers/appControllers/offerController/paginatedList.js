const mongoose = require('mongoose');

const Model = mongoose.model('Offer');

const { ownerFilter, userFilter, isReservedFilterKey } = require('../../../middlewares/ownership');

const paginatedList = async (req, res) => {
  const page = req.query.page || 1;
  const limit = parseInt(req.query.items) || 10;
  const skip = page * limit - limit;

  //  Query the database for a list of all results
  const { sortBy = 'enabled', sortValue = -1, filter, equal } = req.query;

  // The shared paginatedList refuses a reserved key here and this one did not,
  // so the two disagreeing about which fields a caller may name was the only
  // thing standing between them. The guard is hardening rather than a fix: the
  // ownership clause is spread last below, so naming `createdBy` here could
  // never actually have overridden it.
  if (filter !== undefined && isReservedFilterKey(filter)) {
    return res.status(400).json({
      success: false,
      result: [],
      message: 'Invalid filter value',
    });
  }

  const fieldsArray = req.query.fields ? req.query.fields.split(',') : [];

  let fields;

  fields = fieldsArray.length === 0 ? {} : { $or: [] };

  for (const field of fieldsArray) {
    fields.$or.push({ [field]: { $regex: new RegExp(req.query.q, 'i') } });
  }

  //  Query the database for a list of all results
  //
  //  The owner's per-user narrowing is spread on last, alongside the tenant
  //  clause and for the same reason - nothing a caller puts in the query string
  //  can reach past either of them. Both are {} for an account that is not the
  //  workspace owner. See userFilter.
  const resultsPromise = Model.find({
    removed: false,

    [filter]: equal,
    ...fields,
    ...ownerFilter(req),
    ...userFilter(Model, req),
  })
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortValue })
    .populate('createdBy', 'name')
    .exec();

  // Counting the total documents
  const countPromise = Model.countDocuments({
    removed: false,

    [filter]: equal,
    ...fields,
    ...ownerFilter(req),
    ...userFilter(Model, req),
  });

  // Resolving both promises
  const [result, count] = await Promise.all([resultsPromise, countPromise]);
  // Calculating total pages
  const pages = Math.ceil(count / limit);

  // Getting Pagination Object
  const pagination = { page, pages, count };
  if (count > 0) {
    return res.status(200).json({
      success: true,
      result,
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
