const { scopedFilter, userFilter, isReservedFilterKey } = require('../../../middlewares/ownership');
const { datedWindowFor } = require('../../../utils/dateRange');

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

  // Build filter condition safely: reject MongoDB operators in values
  let filterCondition = {};
  if (filter && equal !== undefined) {
    if (typeof equal === 'object' || isReservedFilterKey(filter)) {
      return res.status(400).json({
        success: false,
        result: [],
        message: 'Invalid filter value',
      });
    }
    filterCondition = { [filter]: equal };
  }

  /*
   * Three separate things contribute an `$or` to this query, and two `$or` keys
   * cannot live in one object - whichever is spread last replaces the other.
   *
   *   fields        the text search, when ?q= and ?fields= are given
   *   scopedFilter  a child account's "mine or assigned to me"
   *   userFilter    the owner's "show me only this person's rows"
   *
   * Spreading them together is how a search silently returns the caller's whole
   * list instead of their matches: the scope swallows the query and the table
   * looks like search is broken. Pushing each as its own `$and` entry keeps all
   * three, and reduces to exactly the previous query when only one is present.
   * This is the shape leadController/paginatedList.js already used for the same
   * reason.
   */
  const conditions = [{ removed: false }];

  if (Object.keys(filterCondition).length > 0) conditions.push(filterCondition);
  if (fields.$or) conditions.push(fields);
  conditions.push(scopedFilter(Model, req));

  const perUser = userFilter(Model, req);

  if (Object.keys(perUser).length > 0) conditions.push(perUser);

  /*
   * The header's date window, for the models it applies to and no others.
   *
   * Pushed as its own `$and` entry beside the scope rather than merged into it,
   * so it can only ever remove rows - an account's isolation is decided by
   * scopedFilter above and is unaffected by which window is selected.
   *
   * The gate lives in datedWindowFor, not here: this file is shared by every
   * entity with no list of its own - Payment and Expense among them, and also
   * Product, Taxes and PaymentMode, which a window means nothing for.
   */
  const dateWindow = datedWindowFor(Model, req);

  if (dateWindow) conditions.push(dateWindow);

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
