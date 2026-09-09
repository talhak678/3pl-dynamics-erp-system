const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const settingModules = [
  'src/middlewares/settings/listBySettingKey.js',
  'src/middlewares/settings/readBySettingKey.js',
  'src/middlewares/settings/listAllSettings.js',
  'src/middlewares/settings/updateBySettingKey.js',
  'src/middlewares/settings/increaseBySettingKey.js',
  'src/controllers/coreControllers/settingController/listBySettingKey.js',
  'src/controllers/coreControllers/settingController/readBySettingKey.js',
  'src/controllers/coreControllers/settingController/listAll.js',
  'src/controllers/coreControllers/settingController/updateBySettingKey.js',
  'src/controllers/coreControllers/settingController/updateManySetting.js',
  'src/controllers/coreControllers/setup.js',
];

test('Vercel can load the application without startup model preloading', () => {
  const script = `
    const assert = require('node:assert/strict');
    const mongoose = require('mongoose');
    require(${JSON.stringify(path.join(backendRoot, 'src/app.js'))});
    const expectedModels = [
      'Admin',
      'AdminPassword',
      'Setting',
      'Upload',
      'Client',
      'Company',
      'Employee',
      'Expense',
      'ExpenseCategory',
      'Invoice',
      'Lead',
      'Offer',
      'Order',
      'Payment',
      'PaymentMode',
      'People',
      'Product',
      'ProductCategory',
      'Quote',
      'Shipment',
      'Taxes',
    ];
    for (const modelName of expectedModels) assert.ok(mongoose.models[modelName], modelName);
  `;
  const { status, stderr } = require('node:child_process').spawnSync(
    process.execPath,
    ['-e', script],
    { cwd: backendRoot, encoding: 'utf8' }
  );

  assert.equal(status, 0, stderr);
});
test('Setting consumers register their model when loaded in isolation', async (t) => {
  for (const relativePath of settingModules) {
    await t.test(relativePath, () => {
      const script = `
        const assert = require('node:assert/strict');
        const mongoose = require('mongoose');
        require(${JSON.stringify(path.join(backendRoot, relativePath))});
        assert.ok(mongoose.models.Setting);
      `;
      const { status, stderr } = require('node:child_process').spawnSync(
        process.execPath,
        ['-e', script],
        { cwd: backendRoot, encoding: 'utf8' }
      );

      assert.equal(status, 0, stderr);
    });
  }
});
