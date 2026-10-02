const { migrate } = require('./migrate');
const { leadFilter } = require('../../../middlewares/ownership');

const read = async (Model, req, res) => {
  // Find document by id
  //
  // `assignedTo` resolves to the Admin's name here rather than being handed over
  // as a bare id, because the client cannot resolve it for itself: /api/team is
  // behind requireTenantOwner, so a Sales Executive reading their own lead has
  // no endpoint that would turn the id into a name. The dashboard's board reads
  // listAll instead, which does not populate - see migrate, which handles both
  // shapes deliberately.
  let result = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...leadFilter(req),
  })
    .populate('assignedTo', 'name')
    .exec();
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
