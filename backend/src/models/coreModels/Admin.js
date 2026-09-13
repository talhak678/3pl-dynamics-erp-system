const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const adminSchema = new Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: false,
  },

  // Kill switch. Only an explicit `false` suspends an account, so documents
  // that predate this field stay active.
  isActive: {
    type: Boolean,
    default: true,
  },
  // Control-plane accounts only. A super admin administers tenant accounts and
  // deliberately has no read access to tenant business data.
  isSuperAdmin: {
    type: Boolean,
    default: false,
  },
  // Sidebar modules this account may see. An empty list means every module.
  modulePermissions: {
    type: [String],
    default: [],
  },

  email: {
    type: String,
    lowercase: true,
    trim: true,
    required: true,
  },
  name: { type: String, required: true },
  surname: { type: String },
  photo: {
    type: String,
    trim: true,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  // Descriptive label only. `isSuperAdmin` is the authoritative gate that
  // requireSuperAdmin checks, so changing this value grants no access by itself.
  role: {
    type: String,
    default: 'owner',
    enum: ['owner', 'superadmin'],
  },
});

module.exports = mongoose.model('Admin', adminSchema);
