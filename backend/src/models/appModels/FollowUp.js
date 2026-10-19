const mongoose = require('mongoose');

/**
 * A scheduled sales follow-up.
 *
 * Until this model existed the only follow-up in the product was
 * `Lead.followUpDate` - one date on the lead, with no channel, no notes, no
 * completion state and no history. That field survives, but it is now a CACHE:
 * followUpController keeps it equal to the earliest pending follow-up for the
 * lead, so the pipeline board (which reads the lead) and the Sales Follow-ups
 * module (which reads this collection) can never disagree about when a lead is
 * next due. Both screens write through /api/followup/*, which is what makes the
 * two views one dataset rather than two copies.
 *
 * `date` is the DUE date, not the entry date. It is deliberately not used by the
 * header's global date window: a follow-up is forward-looking work, and a window
 * ending today would hide everything scheduled for tomorrow. The Sales
 * Follow-ups module lists the whole tenant-scoped queue and its own
 * Today/Upcoming/Overdue/Completed tabs do the narrowing. See DATED_MODELS in
 * utils/dateRange.js.
 *
 * `createdBy` is the TENANT (see middlewares/ownership.js); `createdByUser` is
 * the account that scheduled it, and `assignedTo` is who it was handed to. All
 * three are written by the server, never taken from a request body.
 */
const followUpSchema = new mongoose.Schema({
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
  assignedTo: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  /**
   * What the follow-up is about. Exactly one of these is expected: a lead for
   * pipeline work, a client for an existing customer relationship. Both are
   * optional at the schema level so a record whose lead was later deleted does
   * not fail validation on a re-save; the controller validates the link on
   * create and update, which is the moment it can still be refused.
   */
  lead: {
    type: mongoose.Schema.ObjectId,
    ref: 'Lead',
    autopopulate: true,
  },
  client: {
    type: mongoose.Schema.ObjectId,
    ref: 'Client',
    autopopulate: true,
  },

  subject: { type: String, trim: true },
  notes: { type: String, trim: true },

  /** How the follow-up happens. Free text would drift; the enum keeps reports honest. */
  channel: {
    type: String,
    enum: ['Call', 'Email', 'Meeting', 'WhatsApp', 'SMS', 'Visit', 'Other'],
    default: 'Call',
  },

  /** When it is due. The field the global date window measures. */
  date: {
    type: Date,
    required: true,
  },

  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: { type: Date },

  /** What came of it - written when the follow-up is marked complete. */
  outcome: { type: String, trim: true },

  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});

// The list screens ask "what is due for this lead, for this tenant, in this
// window"; this index covers the sync query and the module's default sort.
followUpSchema.index({ createdBy: 1, lead: 1, date: 1 });

followUpSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('FollowUp', followUpSchema);
