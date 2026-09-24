const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },

  createdBy: { type: mongoose.Schema.ObjectId, ref: 'Admin', autopopulate: true, required: true },

  /**
   * Authorship and assignment - the two halves of the child-account read scope.
   *
   * `createdBy` above holds the TENANT this record belongs to, which every
   * tenancy filter in the app matches on, so it cannot also name a person: for
   * anyone but the workspace owner those are two different ids. These two are
   * the person-shaped fields, and middlewares/ownership.js is where they become
   * a query - a child account sees a payment it entered OR one assigned to it,
   * and the workspace owner sees everything.
   *
   * Both are server-written. `createdByUser` is set from the session on create
   * (see paymentController/create.js) and is stripped from every update, so
   * authorship cannot be claimed or given away. `assignedTo` is honoured only
   * from the workspace owner - see utils/assignee.js.
   *
   * Null on records that predate them. Those stay visible to the owner and are
   * simply not matched by a child account's scope, which is the safe direction
   * to fail in.
   */
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
  assignedTo: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  number: {
    type: Number,
    required: true,
  },
  client: {
    type: mongoose.Schema.ObjectId,
    ref: 'Client',
    autopopulate: true,
    required: true,
  },
  invoice: {
    type: mongoose.Schema.ObjectId,
    ref: 'Invoice',
    required: true,
    autopopulate: true,
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'NA',
    uppercase: true,
    required: true,
  },
  ref: {
    type: String,
  },
  description: {
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
paymentSchema.plugin(require('mongoose-autopopulate'));
module.exports = mongoose.model('Payment', paymentSchema);
