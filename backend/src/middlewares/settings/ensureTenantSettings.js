const Model = require('../../models/coreModels/Setting');

// Static requires (instead of globbing the filesystem) so the serverless bundler
// always ships these templates alongside the function.
const defaultSettingsTemplates = [
  ...require('../../setup/defaultSettings/appSettings.json'),
  ...require('../../setup/defaultSettings/clientSettings.json'),
  ...require('../../setup/defaultSettings/companySettings.json'),
  ...require('../../setup/defaultSettings/financeSettings.json'),
  ...require('../../setup/defaultSettings/invoiceSettings.json'),
  ...require('../../setup/defaultSettings/moneyFormatSettings.json'),
  ...require('../../setup/defaultSettings/quoteSettings.json'),
];

/**
 * Gives a tenant their own private copy of the default settings the first time
 * they need them. Strict isolation means a new admin starts with no settings at
 * all, and without this they could never generate an invoice, quote or PDF
 * because every settings lookup is scoped to them.
 *
 * Only the calling admin's own rows are ever created - nothing is copied from
 * another tenant - and it is a no-op once they already have settings.
 */
const ensureTenantSettings = async (adminId) => {
  try {
    if (!adminId) {
      return false;
    }

    const existingCount = await Model.countDocuments({
      createdBy: adminId,
      removed: false,
    });

    if (existingCount > 0) {
      return false;
    }

    const settingsToCreate = defaultSettingsTemplates.map((setting) => ({
      ...setting,
      createdBy: adminId,
    }));

    if (settingsToCreate.length === 0) {
      return false;
    }

    await Model.insertMany(settingsToCreate);

    return true;
  } catch (error) {
    // Seeding settings must never break authentication or any other request.
    return false;
  }
};

module.exports = ensureTenantSettings;
