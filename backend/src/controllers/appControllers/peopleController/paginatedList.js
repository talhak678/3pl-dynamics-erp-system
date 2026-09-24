const { scopedFilter, userFilter, isReservedFilterKey } = require('../../../middlewares/ownership');

const paginatedList = async (Model, req, res) => {
  const page = req.query.page || 1;
  const limit = parseInt(req.query.items) || 10;
  const skip = page * limit - limit;

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
  //  Three things here can contribute an `$or`, and two `$or` keys cannot share
  //  one object - the later spread replaces the earlier, so a text search would
  //  quietly return the caller's whole list instead of their matches. Each goes
  //  in as its own `$and` entry, which is the shape leadController uses.
  //
  //  The owner's per-user narrowing and the child account's own-record scope are
  //  both {} for the accounts they do not describe, and neither can reach past
  //  the tenant clause: that clause is one of the entries, so it only ever
  //  intersects. See scopedFilter and userFilter.
  const conditions = [{ removed: false }, { [filter]: equal }];

  if (fields.$or) conditions.push(fields);
  conditions.push(scopedFilter(Model, req));

  const perUser = userFilter(Model, req);

  if (Object.keys(perUser).length > 0) conditions.push(perUser);

  const query = { $and: conditions };

  const resultsPromise = Model.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortValue })
    .populate('company', 'name')
    .exec();

  // Counting the total documents
  const countPromise = Model.countDocuments(query);

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
