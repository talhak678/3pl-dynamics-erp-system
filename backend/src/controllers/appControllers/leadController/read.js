const { migrate } = require('./migrate');
const { leadFilter } = require('../../../middlewares/ownership');

const read = async (Model, req, res) => {
  // Find document by id
  //
  // `assignedTo` is returned as a bare id like every other endpoint returns it.
  // The Show panel resolves it to a name itself, from the team directory it
  // fetches - populating here would put an object where the edit form's Select
  // expects the id it was given.
  let result = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...leadFilter(req),
  }).exec();
  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    // Return success resposne

    const migratedData = migrate(result);

    return res.status(200).json({
      success: true,
      result: migratedData,
      message: 'we found this document ',
    });
  }
};

module.exports = read;
