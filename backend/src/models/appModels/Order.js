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

  /**
   * Authorship and assignment - the two halves of the child-account read scope.
   *
   * `createdBy` above holds the TENANT this record belongs to, which every
   * tenancy filter in the app matches on, so it cannot also name a person: for
   * anyone but the workspace owner those are two different ids. These two are
   * the person-shaped fields, and middlewares/ownership.js is where they become
   * a query - a child account sees an order it entered OR one assigned to it,
   * and the workspace owner sees everything.
   *
   * Both are server-written by the shared CRUD controller: `createdByUser` is
   * set from the session on create and stripped from every update, so authorship
   * cannot be claimed or given away, and `assignedTo` is honoured only from the
   * workspace owner - see utils/assignee.js.
   *
   * Null on records that predate them. Those stay visible to the owner and are
   * simply not matched by a child account's scope, which is the safe direction
   * to fail in.
   */
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
  assignedTo: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

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
