const mongoose = require('mongoose');

const Model = mongoose.model('Offer');

const custom = require('../../pdfController');

const { calculate } = require('../../../helpers');
const { scopedFilter } = require('../../../middlewares/ownership');
const { applyAssignedTo, stripAuthorship } = require('../../../utils/assignee');

const update = async (req, res) => {
  const { items = [], taxRate = 0, discount = 0 } = req.body;

  if (items.length === 0) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Items cannot be empty',
    });
  }
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
  //
  // The same rule as the create path (see create.js), and deliberately written
  // the same way: an offer must not change its arithmetic by being edited.
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
  body['pdf'] = 'offer-' + req.params.id + '.pdf';

  if (body.hasOwnProperty('currency')) {
    delete body.currency;
  }
  // Find document by id and updates with the required fields

  // Ownership is immutable: never let a caller reassign a record to someone else.
  delete body.createdBy;
  // Nor is authorship, which is what a child account's read scope matches on.
  stripAuthorship(req);

  // Delegation: honoured from the workspace owner only, and dropped from anyone
  // else's body so an existing assignee survives their edit. See utils/assignee.js.
  const assignment = await applyAssignedTo(Model, req);

  if (!assignment.ok) {
    return res.status(assignment.status).json({
      success: false,
      result: null,
      message: assignment.error,
    });
  }

  const result = await Model.findOneAndUpdate(
    { _id: req.params.id, removed: false, ...scopedFilter(Model, req) },
    body,
    {
      new: true, // return the new result instead of the old one
    }
  ).exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Offer not found',
    });
  }

  // Returning successfull response

  return res.status(200).json({
    success: true,
    result,
    message: 'we update this document ',
  });
};
module.exports = update;
