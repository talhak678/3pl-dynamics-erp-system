const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
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
  },

  orderId: {
    type: String,
    required: true,
    trim: true,
  },
  products: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    default: 1,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  notes: {
    type: String,
  },
  status: {
    type: String,
    enum: [
      'pending',
      'shipped',
      'delivered',
      'cancelled',
    ],
    default: 'pending',
  },
  pdf: {
    type: String,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

orderSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('Order', orderSchema);
