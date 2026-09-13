const Model = require('../../models/coreModels/Setting');

const increaseBySettingKey = async ({ settingKey, adminId }) => {
  try {
    if (!settingKey) {
      return null;
    }

    const filter = { settingKey };

    // Tenant isolation: a tenant can only ever increment their own counters.
    if (adminId) {
      filter.createdBy = adminId;
    }

    const result = await Model.findOneAndUpdate(
      filter,
      {
        $inc: { settingValue: 1 },
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

module.exports = increaseBySettingKey;
