/**
 * Normalises an Admin document into the shape the Super Admin API exposes.
 *
 * Written as an explicit whitelist rather than returning the document, so that
 * a field added to the Admin schema later cannot leak into this response by
 * accident. Credential material lives on AdminPassword and is never touched
 * here.
 *
 * The `isActive` / `isSuperAdmin` comparisons are against exact values so that
 * documents predating those fields (which have neither stored) read back with
 * their intended defaults rather than depending on Mongoose applying a default
 * to a projected-out path.
 */
const serializeAdmin = (admin) => ({
  _id: admin._id,
  name: admin.name,
  email: admin.email,
  enabled: admin.enabled === true,
  isActive: admin.isActive !== false,
  isSuperAdmin: admin.isSuperAdmin === true,
  modulePermissions: Array.isArray(admin.modulePermissions) ? admin.modulePermissions : [],
  created: admin.created,
});

module.exports = serializeAdmin;
