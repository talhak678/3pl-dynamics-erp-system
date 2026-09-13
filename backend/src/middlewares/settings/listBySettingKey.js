const Model = require('../../models/coreModels/Setting');

const listBySettingKey = async ({ settingKeyArray = [], adminId }) => {
  try {
    // Find document by id

    const settingsToShow = { $or: [] };

    if (settingKeyArray.length === 0) {
      return [];
    }

    for (const settingKey of settingKeyArray) {
      settingsToShow.$or.push({ settingKey });
    }

    const query = { ...settingsToShow };

    // Tenant isolation: a tenant can only read their own settings.
    if (adminId) {
      query.createdBy = adminId;
    }

    let results = await Model.find(query).where('removed', false);

    // If no results found, return document not found
    if (results.length >= 1) {
      return results;
    } else {
      return [];
    }
  } catch {
    return [];
  }
};

module.exports = listBySettingKey;
