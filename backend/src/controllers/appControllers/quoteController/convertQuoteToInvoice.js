const mongoose = require('mongoose');
const moment = require('moment');

const Model = mongoose.model('Quote');
const InvoiceModel = mongoose.model('Invoice');

const { ownerFilter } = require('../../../middlewares/ownership');

const convertQuoteToInvoice = async (req, res) => {
  // Fetch the quote from the database
  const quote = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...ownerFilter(req),
  }).exec();

  if (!quote) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Quote not found',
    });
  }

  // If the quote is already converted, prevent creating another invoice
  if (quote.converted) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'Quote is already converted to an invoice.',
    });
  }

  // Convert the quote details to invoice details
  const invoiceData = {
    number: quote.number,
    year: quote.year,
    date: moment(),
    expiredDate: moment().add(1, 'month'),
    client: quote.client,
    items: quote.items.map((item) => ({
      itemName: item.itemName,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
    })),
    taxRate: quote.taxRate,
    subTotal: quote.subTotal,
    taxTotal: quote.taxTotal,
    total: quote.total,
    credit: quote.credit,
    discount: quote.discount,
    notes: quote.notes,
  };

  invoiceData['createdBy'] = req.admin.tenantId;
  // Creating a new document in the collection

  // Create the invoice document
  const invoice = await new InvoiceModel(invoiceData).save();

  // Mark the quote as converted
  quote['createdBy'] = req.admin.tenantId;
  quote.converted = true;
  await quote.save();

  // Return the created invoice
  return res.status(200).json({
    success: true,
    result: quote,
    message: 'Successfully converted quote to invoice',
  });
};

module.exports = convertQuoteToInvoice;
