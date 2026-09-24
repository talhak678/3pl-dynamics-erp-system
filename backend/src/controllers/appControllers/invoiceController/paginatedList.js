const mongoose = require('mongoose');

const Model = mongoose.model('Invoice');

const { scopedFilter, userFilter } = require('../../../middlewares/ownership');

const paginatedList = async (req, res) => {
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

  //  Query the database for a list of all results
  //
  //  Three things here can contribute an `$or`, and two `$or` keys cannot share
  //  one object - the later spread replaces the earlier, so a text search would
  //  quietly return the caller's whole list instead of their matches. Each goes
  //  in as its own `$and` entry, which is the shape leadController uses.
  //
  //  `userFilter` is what answers `?user=<id>` for this entity, and it is the
  //  workspace owner alone who gets a clause back - a child account asking for
  //  someone else keeps the scope its own account already has. See userFilter.
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
    .populate('createdBy', 'name')
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
