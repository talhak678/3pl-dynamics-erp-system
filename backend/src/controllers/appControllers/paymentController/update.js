const mongoose = require('mongoose');

const Model = mongoose.model('Payment');
const Invoice = mongoose.model('Invoice');
const custom = require('../../pdfController');

const { calculate } = require('../../../helpers');
const { scopedFilter } = require('../../../middlewares/ownership');
const { applyAssignedTo, stripAuthorship } = require('../../../utils/assignee');

const update = async (req, res) => {
  if (req.body.amount === 0) {
    return res.status(202).json({
      success: false,
      result: null,
      message: `The Minimum Amount couldn't be 0`,
    });
  }
  // Find document by id and updates with the required fields
  const previousPayment = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...scopedFilter(Model, req),
  });

  if (!previousPayment) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  }

  const { amount: previousAmount } = previousPayment;
  const { id: invoiceId, total, discount, credit: previousCredit } = previousPayment.invoice;

  const { amount: currentAmount } = req.body;

  const changedAmount = calculate.sub(currentAmount, previousAmount);
  const maxAmount = calculate.sub(total, calculate.add(discount, previousCredit));

  if (changedAmount > maxAmount) {
    return res.status(202).json({
      success: false,
      result: null,
      message: `The Max Amount you can add is ${maxAmount + previousAmount}`,
      error: `The Max Amount you can add is ${maxAmount + previousAmount}`,
    });
  }

  let paymentStatus =
    calculate.sub(total, discount) === calculate.add(previousCredit, changedAmount)
      ? 'paid'
      : calculate.add(previousCredit, changedAmount) > 0
      ? 'partially'
      : 'unpaid';

  // Authorship is never editable - see utils/assignee.js. The `updates` object
  // below is built field by field rather than spread from the body, so there is
  // nothing to strip; this is called for symmetry with the other update paths.
  stripAuthorship(req);

  // Delegation, which for this controller has to be carried into `updates` by
  // hand for the same reason. Only the workspace owner gets a value here, and an
  // owner who did not mention the field leaves it absent - see applyAssignedTo.
  const assignment = await applyAssignedTo(Model, req);

  if (!assignment.ok) {
    return res.status(assignment.status).json({
      success: false,
      result: null,
      message: assignment.error,
    });
  }

  const updatedDate = new Date();
  const updates = {
    number: req.body.number,
    date: req.body.date,
    amount: req.body.amount,
    paymentMode: req.body.paymentMode,
    ref: req.body.ref,
    description: req.body.description,
    updated: updatedDate,
  };

  if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')) {
    updates.assignedTo = req.body.assignedTo;
  }

  const result = await Model.findOneAndUpdate(
    { _id: req.params.id, removed: false, ...scopedFilter(Model, req) },
    { $set: updates },
    {
      new: true, // return the new result instead of the old one
    }
  ).exec();

  const updateInvoice = await Invoice.findOneAndUpdate(
    { _id: result.invoice._id.toString(), ...scopedFilter(Invoice, req) },
    {
      $inc: { credit: changedAmount },
      $set: {
        paymentStatus: paymentStatus,
      },
    },
    {
      new: true, // return the new result instead of the old one
    }
  ).exec();

  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully updated the Payment ',
  });
};

module.exports = update;
