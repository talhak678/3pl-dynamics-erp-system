const mongoose = require('mongoose');

/**
 * OnlineOrder Model
 *
 * Captures orders incoming from external e-commerce platforms (Shopify, WooCommerce, Custom API).
 * Stores raw platform order details, customer snapshot, line items, and fulfillment links to ERP Order.
 */
const onlineOrderSchema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: true,
  },

  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
    required: true,
  },
  createdByUser: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },

  orderNumber: {
    type: String,
    required: true,
    trim: true,
  },
  externalOrderId: {
    type: String,
    trim: true,
  },
  websiteConfig: {
    type: mongoose.Schema.ObjectId,
    ref: 'WebsiteConfig',
    autopopulate: true,
  },

  customer: {
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    postalCode: { type: String, trim: true },
  },

  items: [
    {
      productId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
      },
      name: { type: String, required: true },
      sku: { type: String, trim: true },
      quantity: { type: Number, default: 1, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true },
    },
  ],

  subtotal: {
    type: Number,
    default: 0,
  },
  taxTotal: {
    type: Number,
    default: 0,
  },
  shippingTotal: {
    type: Number,
    default: 0,
  },
  discountTotal: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
  },

  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'failed', 'refunded'],
    default: 'pending',
  },
  fulfillmentStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    default: 'Credit Card',
  },
  notes: {
    type: String,
    trim: true,
  },
  syncedAt: {
    type: Date,
    default: Date.now,
  },

  // Link to internal ERP Order when converted
  erpOrderId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    autopopulate: true,
  },

  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});

onlineOrderSchema.index({ createdBy: 1, orderNumber: 1, externalOrderId: 1 });
onlineOrderSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('OnlineOrder', onlineOrderSchema);
