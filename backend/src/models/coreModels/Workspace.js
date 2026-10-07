const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * A workspace: the customer account that a tenant's users belong to.
 *
 * The Super Admin portal creates one of these first, then creates the Customer
 * Admin that owns it. That order is the point of the collection - a tenant
 * account cannot exist without one to attach to, which is why `Admin.workspace`
 * is enforced at the create endpoint rather than by a schema-level `required`.
 *
 * This is deliberately NOT the existing tenancy. Tenancy in this ERP is
 * `Admin.parentAdminId` (with the `tenantId` virtual), which decides whose
 * invoices, clients and settings an account works on. A workspace sits one
 * level above that: it is an attribute of an account, describing which customer
 * it was provisioned for. Nothing scopes queries by workspace, and the two must
 * not be conflated - `createdBy` on every other model means the tenant, while
 * here it records the control-plane account that created the row.
 *
 * Status is modelled as the ERP's two booleans rather than the source system's
 * integer enum, so this collection behaves like every other one here:
 *
 *   active        -> isActive true,  removed false
 *   inactive      -> isActive false, removed false
 *   deleted       -> removed true    (soft delete)
 *
 * `isActive` is what the Super Admin portal's workspace dropdown filters on, so
 * deactivating a workspace stops new accounts being created against it without
 * disturbing the accounts already on it.
 */
const workspaceSchema = new Schema({
  removed: {
    type: Boolean,
    default: false,
  },

  // Kill switch, matching Admin's. Only an explicit `false` makes a workspace
  // inactive, so a document written before this field existed still counts as
  // usable rather than silently dropping out of the dropdown.
  isActive: {
    type: Boolean,
    default: true,
  },

  // Unique per workspace and used as its human handle, so it is stored
  // upper-cased and trimmed rather than however it was typed. The uniqueness
  // check in createWorkspace is what produces a readable 409; the index here is
  // the guarantee behind it, and would reject a duplicate even if two requests
  // raced past that check.
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    unique: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  // The customer's contact details. Optional: a workspace is created before the
  // details are always to hand, and refusing to record one for want of a phone
  // number would defeat the module.
  customerName: {
    type: String,
    trim: true,
  },
  customerEmail: {
    type: String,
    lowercase: true,
    trim: true,
  },
  customerPhone: {
    type: String,
    trim: true,
  },

  // The control-plane account that created this workspace. Named `createdBy` for
  // consistency with the rest of the schema, but note it does not scope
  // anything: a workspace is not inside a tenant, it is what a tenant is
  // attached to.
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Workspace', workspaceSchema);
