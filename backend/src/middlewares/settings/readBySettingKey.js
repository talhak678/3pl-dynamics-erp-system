const Model = require('../../models/coreModels/Setting');

const readBySettingKey = async ({ settingKey, adminId }) => {
  try {
    // Find document by id

    if (!settingKey) {
      return null;
    }

    const query = { settingKey };

    // Tenant isolation: a tenant can only read their own settings.
    if (adminId) {
      query.createdBy = adminId;
    }

    const result = await Model.findOne(query);
    // If no results found, return document not found
    if (!result) {
      return null;
    } else {
      // Return success resposne
      return result;
    }
  } catch {
    return null;
  }
};

module.exports = readBySettingKey;
