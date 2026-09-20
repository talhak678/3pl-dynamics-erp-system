const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: true,
  },

  type: {
    type: String,
    default: 'company',
    enum: ['company', 'people'],
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  company: { type: mongoose.Schema.ObjectId, ref: 'Company', autopopulate: true },
  people: { type: mongoose.Schema.ObjectId, ref: 'People', autopopulate: true },
  interestedIn: [{ type: mongoose.Schema.ObjectId, ref: 'Product' }],
  offer: [{ type: mongoose.Schema.ObjectId, ref: 'Offer' }],
  converted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
  assigned: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  /**
   * The account that typed this lead in, as distinct from `createdBy` above,
   * which holds the TENANT the lead belongs to.
   *
   * The distinction is not cosmetic. Every tenancy filter in the app is
   * `createdBy: <tenant id>`, so `createdBy` cannot also identify a person: for
   * anyone but the workspace owner those are two different ids. The Sales
   * Pipeline needs "leads I entered", which is a question about a person, so it
   * needs its own field.
   *
   * Null on records that predate it. Those stay visible to the owner and are
   * simply not matched by a Sales Executive's "created by me" clause, which is
   * the safe direction to fail in.
   */
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  // Where the lead sits in the sales pipeline. Defaulted rather than required so
  // every document that predates the pipeline reads as 'New' instead of failing
  // validation or rendering a blank column.
  salesStage: {
    type: String,
    default: 'New',
    enum: [
      'New',
      'Contacted',
      'Follow-Up',
      'Meeting/Demo',
      'Proposal Sent',
      'In Negotiation',
      'Won',
      'Lost',
    ],
  },

  // The Sales Executive who works this lead. Must belong to the same workspace;
  // the lead controllers check that before writing it.
  assignedTo: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  followUpDate: { type: Date },
  subTotal: {
    type: Number,
  },
  taxTotal: {
    type: Number,
  },
  total: {
    type: Number,
  },
  discount: {
    type: Number,
  },
  images: [
    {
      id: String,
      name: String,
      path: String,
      description: String,
      isPublic: {
        type: Boolean,
        default: false,
      },
    },
  ],
  files: [
    {
      id: String,
      name: String,
      path: String,
      description: String,
      isPublic: {
        type: Boolean,
        default: false,
      },
    },
  ],
  category: String,
  status: String,
  notes: String,
  source: String,
  approved: {
    type: Boolean,
    default: false,
  },
  tags: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],
  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});

schema.plugin(require('mongoose-autopopulate'));
module.exports = mongoose.model('Lead', schema);
