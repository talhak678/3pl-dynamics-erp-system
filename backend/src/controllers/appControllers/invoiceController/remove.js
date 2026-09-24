const mongoose = require('mongoose');

const Model = mongoose.model('Invoice');
const ModelPayment = mongoose.model('Payment');

const { scopedFilter } = require('../../../middlewares/ownership');

const remove = async (req, res) => {
  const deletedInvoice = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
      removed: false,
      ...scopedFilter(Model, req),
    },
    {
      $set: {
        removed: true,
      },
    }
  ).exec();

  if (!deletedInvoice) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Invoice not found',
    });
  }
  // The payments of THIS invoice, scoped as Payment rather than Invoice: they
  // are a different model and carry their own authorship, so the clause has to
  // be built from their schema. For a child account this reaches the payments it
  // entered or was given - which, since it could only ever have paid an invoice
  // it could see, is all of them.
  const paymentsInvoices = await ModelPayment.updateMany(
    { invoice: deletedInvoice._id, ...scopedFilter(ModelPayment, req) },
    { $set: { removed: true } }
  );
  return res.status(200).json({
    success: true,
    result: deletedInvoice,
    message: 'Invoice deleted successfully',
  });
};

module.exports = remove;
