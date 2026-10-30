const mongoose = require('mongoose');

/**
 * WebsiteConfig Model
 *
 * Represents an external website or e-commerce store integration
 * (e.g., Shopify, WooCommerce, Webflow, Custom REST API).
 * Stores API credentials, connection status, and automated synchronization rules.
 */
const websiteConfigSchema = new mongoose.Schema({
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

  name: {
    type: String,
    required: true,
    trim: true,
  },
  platform: {
    type: String,
    enum: ['Shopify', 'WooCommerce', 'Custom API', 'Webflow', 'Magento', 'BigCommerce'],
    default: 'Shopify',
    required: true,
  },
  storeUrl: {
    type: String,
    required: true,
    trim: true,
  },
  apiKey: {
    type: String,
    trim: true,
  },
  apiSecret: {
    type: String,
    trim: true,
  },
  webhookSecret: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'error', 'pending'],
    default: 'pending',
  },
  lastSyncDate: {
    type: Date,
  },
  syncFrequency: {
    type: String,
    enum: ['manual', '15min', 'hourly', 'daily', 'realtime'],
    default: 'hourly',
  },
  autoSyncProducts: {
    type: Boolean,
    default: true,
  },
  autoSyncOrders: {
    type: Boolean,
    default: true,
  },
  autoSyncCustomers: {
    type: Boolean,
    default: true,
  },
  notes: {
    type: String,
    trim: true,
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

websiteConfigSchema.index({ createdBy: 1, removed: 1 });

module.exports = mongoose.model('WebsiteConfig', websiteConfigSchema);
