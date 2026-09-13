const Model = require('../../models/coreModels/Setting');

const listAllSettings = async (adminId) => {
  try {
    const query = {
      removed: false,
    };

    // Tenant isolation: settings belong to the admin who owns them.
    if (adminId) {
      query.createdBy = adminId;
    }

    //  Query the database for a list of all results
    const result = await Model.find(query).exec();

    if (result.length > 0) {
      return result;
    } else {
      return [];
    }
  } catch {
    return [];
  }
};

module.exports = listAllSettings;
