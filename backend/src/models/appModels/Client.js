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

  name: {
    type: String,
    required: true,
  },
  phone: String,
  country: String,
  address: String,
  email: String,
  createdBy: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  /**
   * The account that entered this record, as distinct from `createdBy` above,
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

  assigned: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
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

module.exports = mongoose.model('Client', schema);
