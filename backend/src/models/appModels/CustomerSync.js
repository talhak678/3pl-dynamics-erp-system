const mongoose = require('mongoose');

/**
 * CustomerSync Model
 *
 * Captures external contacts, e-commerce checkout buyers, and SaaS/web form leads.
 * Provides auditing, contact metadata, and direct conversion/linking into ERP Client or Lead records.
 */
const customerSyncSchema = new mongoose.Schema({
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

  websiteConfig: {
    type: mongoose.Schema.ObjectId,
    ref: 'WebsiteConfig',
    autopopulate: true,
  },

  sourcePlatform: {
    type: String,
    default: 'Shopify',
    trim: true,
  },
  sourceType: {
    type: String,
    enum: ['ecommerce_checkout', 'saas_contact_form', 'newsletter', 'demo_request'],
    default: 'ecommerce_checkout',
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  company: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    trim: true,
  },
  country: {
    type: String,
    trim: true,
  },

  externalCustomerId: {
    type: String,
    trim: true,
  },
  totalOrders: {
    type: Number,
    default: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
  },
  message: {
    type: String,
    trim: true,
  },

  // Linking to ERP CRM
  crmStatus: {
    type: String,
    enum: ['unlinked', 'linked_client', 'linked_lead'],
    default: 'unlinked',
  },
  crmClientId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Client',
    autopopulate: true,
  },
  crmLeadId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Lead',
    autopopulate: true,
  },

  syncedAt: {
    type: Date,
    default: Date.now,
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

customerSyncSchema.index({ createdBy: 1, email: 1 });
customerSyncSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('CustomerSync', customerSyncSchema);
