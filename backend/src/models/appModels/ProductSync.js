const mongoose = require('mongoose');

/**
 * ProductSync Model
 *
 * Tracks the synchronization state between an internal ERP Product and an external e-commerce store.
 * Holds mapping to external product IDs, price overrides, stock levels, and error logs.
 */
const productSyncSchema = new mongoose.Schema({
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

  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true,
    autopopulate: true,
  },
  websiteConfig: {
    type: mongoose.Schema.ObjectId,
    ref: 'WebsiteConfig',
    autopopulate: true,
  },

  externalProductId: {
    type: String,
    trim: true,
  },
  externalHandle: {
    type: String,
    trim: true,
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed', 'not_synced'],
    default: 'pending',
  },
  lastSyncDate: {
    type: Date,
  },
  externalPrice: {
    type: Number,
  },
  stockQuantity: {
    type: Number,
    default: 0,
  },
  syncErrors: {
    type: String,
    trim: true,
  },
  autoSync: {
    type: Boolean,
    default: true,
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

productSyncSchema.index({ createdBy: 1, product: 1, websiteConfig: 1 });
productSyncSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('ProductSync', productSyncSchema);
