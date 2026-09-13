const Model = require('../../models/coreModels/Setting');

const updateBySettingKey = async ({ settingKey, settingValue, adminId }) => {
  try {
    if (!settingKey || !settingValue) {
      return null;
    }

    const filter = { settingKey };

    // Tenant isolation: a tenant can only ever write their own settings.
    if (adminId) {
      filter.createdBy = adminId;
    }

    const result = await Model.findOneAndUpdate(
      filter,
      {
        settingValue,
      },
      {
        new: true, // return the new result instead of the old one
        runValidators: true,
      }
    ).exec();
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

module.exports = updateBySettingKey;
