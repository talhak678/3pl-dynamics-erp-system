const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { ADMIN_ROLES } = require('../../utils/roles');

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

  // The account this one belongs to, when it is an employee rather than the
  // tenant owner. Null for owners and super admins, which own themselves.
  //
  // This is the tenancy link: it decides whose invoices, clients and settings
  // the account works on. It is written once at creation by teamController and
  // is not accepted from any request body, so an employee cannot reparent
  // themselves into another company.
  parentAdminId: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
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
  // A job title for employees, and one of two tenancy roles for the accounts
  // this platform itself creates.
  //
  // Mostly descriptive: it grants no module access, which is
  // `modulePermissions`. But not purely descriptive, so do not treat it as a
  // free-text label - 'owner' is what requireTenantOwner checks to decide who
  // may manage a workspace's users, and 'superadmin' is what requireSuperAdmin
  // checks on the control plane. Those are the only two places it gates
  // anything, and both compare against a literal.
  //
  // The enum is deliberately WIDER than what /api/team will accept. It says what
  // an account may BE; utils/roles.js says what a tenant may HAND OUT, which is
  // this list minus 'owner' and 'superadmin'. Values outside the assignable set
  // exist for accounts the platform creates and are rejected at the team
  // endpoints, not here.
  role: {
    type: String,
    default: 'owner',
    enum: ADMIN_ROLES,
  },
});

/**
 * The id every tenancy decision must use — whose data this account works on.
 *
 * An owner's tenant is themselves; an employee's is the account that created
 * them. Every `createdBy` filter, every `createdBy` assignment and every
 * settings lookup resolves through this, which is what makes an employee see
 * their employer's workspace instead of an empty one of their own.
 *
 * It is a virtual rather than a stored field so it cannot drift from the two
 * fields it derives from, and it is deliberately total: it always returns an
 * ObjectId, falling back to `_id`. A reader that forgot to handle the employee
 * case therefore gets the account's own id — a wrong-but-contained scope —
 * rather than `undefined`, which in a Mongo filter would match every document
 * with a missing `createdBy` and cross the tenant boundary outright.
 *
 * Not persisted, and not serialised: toJSON does not include virtuals here, so
 * it never reaches a client payload.
 */
adminSchema.virtual('tenantId').get(function tenantId() {
  return this.parentAdminId || this._id;
});

module.exports = mongoose.model('Admin', adminSchema);
