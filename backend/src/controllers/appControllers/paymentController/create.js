const mongoose = require('mongoose');

const Model = mongoose.model('Payment');
const Invoice = mongoose.model('Invoice');
const custom = require('../../pdfController');

const { calculate } = require('../../../helpers');
const { scopedFilter } = require('../../../middlewares/ownership');
const { applyAssignedTo } = require('../../../utils/assignee');

const create = async (req, res) => {
  // Creating a new document in the collection
  if (req.body.amount === 0) {
    return res.status(202).json({
      success: false,
      result: null,
      message: `The Minimum Amount couldn't be 0`,
    });
  }

  // The invoice this payment settles is read through the caller's own scope, not
  // the tenant's: a child account settling invoices it cannot open is not a
  // workflow this app offers, and paying one requires reading its totals below.
  const currentInvoice = await Invoice.findOne({
    _id: req.body.invoice,
    removed: false,
    ...scopedFilter(Invoice, req),
  });

  if (!currentInvoice) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Invoice not found',
    });
  }

  const {
    total: previousTotal,
    discount: previousDiscount,
    credit: previousCredit,
  } = currentInvoice;

  const maxAmount = calculate.sub(calculate.sub(previousTotal, previousDiscount), previousCredit);

  if (req.body.amount > maxAmount) {
    return res.status(202).json({
      success: false,
      result: null,
      message: `The Max Amount you can add is ${maxAmount}`,
    });
  }
  req.body['createdBy'] = req.admin.tenantId;

  // Authorship rather than ownership - see the note on the generic create in
  // middlewaresControllers/createCRUDController/create.js. This controller is
  // bespoke, so it has to set the field itself; the shared one never runs here.
  req.body['createdByUser'] = req.admin._id;

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

  const result = await Model.create(req.body);

  const fileId = 'payment-' + result._id + '.pdf';
  const updatePath = await Model.findOneAndUpdate(
    {
      _id: result._id.toString(),
      removed: false,
      ...scopedFilter(Model, req),
    },
    { pdf: fileId },
    {
      new: true,
    }
  ).exec();
  // Returning successfull response

  const { _id: paymentId, amount } = result;
  const { id: invoiceId, total, discount, credit } = currentInvoice;

  let paymentStatus =
    calculate.sub(total, discount) === calculate.add(credit, amount)
      ? 'paid'
      : calculate.add(credit, amount) > 0
      ? 'partially'
      : 'unpaid';

  const invoiceUpdate = await Invoice.findOneAndUpdate(
    { _id: req.body.invoice, ...scopedFilter(Invoice, req) },
    {
      $push: { payment: paymentId.toString() },
      $inc: { credit: amount },
      $set: { paymentStatus: paymentStatus },
    },
    {
      new: true, // return the new result instead of the old one
      runValidators: true,
    }
  ).exec();

  return res.status(200).json({
    success: true,
    result: updatePath,
    message: 'Payment Invoice created successfully',
  });
};

module.exports = create;
