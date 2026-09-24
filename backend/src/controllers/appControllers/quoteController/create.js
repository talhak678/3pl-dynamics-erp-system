const mongoose = require('mongoose');

const Model = mongoose.model('Quote');

const custom = require('../../pdfController');
const { increaseBySettingKey } = require('../../../middlewares/settings');
const { calculate } = require('../../../helpers');
const { scopedFilter } = require('../../../middlewares/ownership');
const { applyAssignedTo } = require('../../../utils/assignee');

const create = async (req, res) => {
  const { items = [], taxRate = 0, discount = 0 } = req.body;

  // default
  let subTotal = 0;
  let taxTotal = 0;
  let total = 0;
  // let credit = 0;

  //Calculate the items array with subTotal, total, taxTotal
  items.map((item) => {
    let total = calculate.multiply(item['quantity'], item['price']);
    //sub total
    subTotal = calculate.add(subTotal, total);
    //item total
    item['total'] = total;
  });
  taxTotal = calculate.multiply(subTotal, taxRate / 100);
  total = calculate.add(subTotal, taxTotal);

  let body = req.body;

  body['subTotal'] = subTotal;
  body['taxTotal'] = taxTotal;
  body['total'] = total;
  body['items'] = items;
  body['createdBy'] = req.admin.tenantId;

  // Authorship rather than ownership - see the note on the generic create in
  // middlewaresControllers/createCRUDController/create.js. This controller is
  // bespoke, so it has to set the field itself; the shared one never runs here.
  body['createdByUser'] = req.admin._id;

  // Delegation, where the workspace owner names an assignee. Everyone else has
  // the field dropped. See utils/assignee.js.
  const assignment = await applyAssignedTo(Model, req);

  if (!assignment.ok) {
    return res.status(assignment.status).json({
      success: false,
      result: null,
      message: assignment.error,
    });
  }

  // Creating a new document in the collection
  const result = await new Model(body).save();
  const fileId = 'quote-' + result._id + '.pdf';
  const updateResult = await Model.findOneAndUpdate(
    { _id: result._id, ...scopedFilter(Model, req) },
    { pdf: fileId },
    {
      new: true,
    }
  ).exec();
  // Returning successfull response

  increaseBySettingKey({
    settingKey: 'last_quote_number',
    adminId: req.admin.tenantId,
  });

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result: updateResult,
    message: 'Quote created successfully',
  });
};
module.exports = create;
