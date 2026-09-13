const listAllSettings = require('./listAllSettings');

const loadSettings = async (adminId) => {
  const allSettings = {};
  const datas = await listAllSettings(adminId);
  datas.forEach(({ settingKey, settingValue }) => {
    allSettings[settingKey] = settingValue;
  });
  return allSettings;
};

module.exports = loadSettings;
