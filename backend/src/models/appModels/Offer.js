const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },

  createdBy: { type: mongoose.Schema.ObjectId, ref: 'Admin', required: true },

  /**
   * The account that entered this offer, as distinct from `createdBy` above,
   * which holds the TENANT it belongs to.
   *
   * Every tenancy filter in the app is `createdBy: <tenant id>`, so that field
   * cannot also name a person: for anyone but the workspace owner those are two
   * different ids. The owner's "show me only this person's rows" filter is a
   * question about a person, so it needs a field of its own. See
   * middlewares/ownership.js, which only applies that filter to models carrying
   * this path.
   *
   * Null on records that predate it. Those stay visible to the owner and are
   * simply not matched by a per-user filter, which is the safe direction to fail
   * in.
   */
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  /**
   * The account this offer was handed to, if the workspace owner delegated it.
   *
   * The second half of the child-account read scope: an offer is visible to the
   * account that entered it OR to the account it was assigned to, and to nobody
   * else. See middlewares/ownership.js, which is where that rule lives and which
   * names this model among the ones it narrows.
   *
   * Only the workspace owner may set it. Anyone else sending the field has it
   * dropped before the write - see utils/assignee.js.
   */
  assignedTo: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  converted: {
    type: Boolean,
    default: false,
  },
  number: {
    type: Number,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  content: String,
  date: {
    type: Date,
    required: true,
  },
  lead: {
    type: mongoose.Schema.ObjectId,
    ref: 'Lead',
    required: true,
    autopopulate: true,
  },
  items: [
    {
      itemName: {
        type: String,
        required: true,
      },
      description: {
        type: String,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      // taxRate: {
      //   type: Number,
      //   default: 0,
      // },
      // subTotal: {
      //   type: Number,
      //   default: 0,
      // },
      // taxTotal: {
      //   type: Number,
      //   default: 0,
      // },
      total: {
        type: Number,
        required: true,
      },
    },
  ],
  currency: {
    type: String,
    default: 'NA',
    uppercase: true,
    required: true,
  },
  taxRate: {
    type: Number,
  },
  subTotal: {
    type: Number,
  },
  subOfferTotal: {
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
    default: 0,
  },
  notes: {
    type: String,
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'sent', 'accepted', 'declined', 'cancelled', 'on hold'],
    default: 'draft',
  },
  approved: {
    type: Boolean,
    default: false,
  },
  isExpired: {
    type: Boolean,
    default: false,
  },
  pdf: {
    type: String,
  },
  files: [
    {
      id: String,
      name: String,
      path: String,
      description: String,
      isPublic: {
        type: Boolean,
        default: true,
      },
    },
  ],
  updated: {
    type: Date,
    default: Date.now,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

offerSchema.plugin(require('mongoose-autopopulate'));
module.exports = mongoose.model('Offer', offerSchema);
