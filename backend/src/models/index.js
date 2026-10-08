require('./coreModels/Admin');
require('./coreModels/AdminPassword');
require('./coreModels/Setting');
require('./coreModels/Upload');
// The bytes behind a product's photos. Registered here like any other model,
// but deliberately not an appModel: models/utils would then generate a full CRUD
// route for it, and this is internal storage with nothing to edit directly.
require('./coreModels/ProductImage');
require('./coreModels/Workspace');

require('./appModels/Client');
require('./appModels/Company');
require('./appModels/Employee');
require('./appModels/Expense');
require('./appModels/ExpenseCategory');
require('./appModels/Invoice');
require('./appModels/Lead');
require('./appModels/Offer');
require('./appModels/Order');
require('./appModels/Payment');
require('./appModels/PaymentMode');
require('./appModels/People');
require('./appModels/Product');
require('./appModels/ProductCategory');
require('./appModels/Quote');
require('./appModels/Shipment');
require('./appModels/Taxes');
