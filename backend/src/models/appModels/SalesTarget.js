const mongoose = require('mongoose');

/**
 * A sales target for a period.
 *
 * The target figure is stored; the achieved figure is NOT. Progress is derived
 * on every read from the workspace's real invoices, orders and won leads, so a
 * target can never drift away from the records it describes - there is no
 * second copy to keep in step, and no nightly job to forget to run.
 *
 * `startDate`/`endDate` are the target's own period, and they are what the
 * achievement aggregation is measured over. They are intentionally not called
 * `date`: the header's global window measures `created` on this model (see
 * utils/dateRange.js), which decides which target CARDS are listed, while
 * `startDate`/`endDate` decide which real records count toward each target.
 * Those are two separate questions and collapsing them would make a target's
 * own numbers change every time the reader moved the header control.
 *
 * `assignee` is optional: absent means company-wide. It is a person, not a
 * tenant - tenancy is `createdBy` as everywhere else - and a child account
 * viewing the module is shown the targets assigned to them plus the
 * company-wide ones (see salesTargetController/listAll.js).
 */
const salesTargetSchema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: true,
  },

  createdBy: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  title: {
    type: String,
    required: true,
    trim: true,
  },

  period: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Yearly', 'Custom'],
    default: 'Monthly',
  },

  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },

  /**
   * What is being measured:
   *   Revenue  a money figure, achieved from invoices in the period
   *   Deals    a count of closed business, achieved from orders and won leads
   */
  type: {
    type: String,
    enum: ['Revenue', 'Deals'],
    default: 'Revenue',
  },

  targetValue: {
    type: Number,
    required: true,
    min: 0,
  },

  assignee: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  notes: { type: String, trim: true },

  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});

salesTargetSchema.index({ createdBy: 1, startDate: 1, endDate: 1 });

salesTargetSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('SalesTarget', salesTargetSchema);
