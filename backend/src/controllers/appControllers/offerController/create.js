const mongoose = require('mongoose');

const Model = mongoose.model('Offer');

const custom = require('../../pdfController');

const { calculate } = require('../../../helpers');
const { increaseBySettingKey } = require('../../../middlewares/settings');
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
  // The discount comes off the subtotal, and comes off before the tax is worked
  // out, so it reduces the amount being taxed rather than being taken off an
  // already-taxed figure: a discounted offer is not taxed on money the customer
  // is not paying.
  //
  // Held to a number before it reaches the arithmetic, because the value comes
  // from a form field - an emptied one posts null, and null has to mean no
  // discount. Clamped to the subtotal because a discount is a reduction and
  // nothing else: a negative one would raise the total, and one larger than the
  // subtotal would leave a negative amount due.
  const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), subTotal);

  const payableSubTotal = calculate.sub(subTotal, discountAmount);

  taxTotal = calculate.multiply(payableSubTotal, taxRate / 100);
  total = calculate.add(payableSubTotal, taxTotal);

  let body = req.body;

  // Written back, so the stored discount is the one the stored totals were
  // worked out from - and the clamped one, not whatever was posted.
  body['discount'] = discountAmount;
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
  const fileId = 'offer-' + result._id + '.pdf';
  const updateResult = await Model.findOneAndUpdate(
    { _id: result._id, ...scopedFilter(Model, req) },
    { pdf: fileId },
    {
      new: true,
    }
  ).exec();
  // Returning successfull response

  increaseBySettingKey({
    settingKey: 'last_offer_number',
    adminId: req.admin.tenantId,
  });

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result: updateResult,
    message: 'Offer created successfully',
  });
};
module.exports = create;
