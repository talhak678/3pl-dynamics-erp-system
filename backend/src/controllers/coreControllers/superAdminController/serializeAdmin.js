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

/**
 * The account's workspace, from either of the two shapes the field arrives in.
 *
 * `listUsers` populates the path, so it is a Workspace document; every other
 * caller hands over the bare ObjectId straight off the Admin document. Only a
 * populated document carries a name, and that is what is tested here -
 * deliberately NOT `typeof workspace === 'object'`, which a bare ObjectId
 * satisfies as well. That test would report every id as though it were a
 * populated workspace and render an empty name for every row; it is the same
 * mistake that broke the assign-to dropdowns, so do not reintroduce it here.
 *
 * With no name to offer, the id is still returned so the client can fall back
 * to it rather than showing nothing. Null means the account predates the
 * workspace requirement and has not been through the backfill.
 */
const serializeWorkspaceRef = (workspace) => {
  if (!workspace) return null;

  const populated = typeof workspace.name === 'string';

  return {
    _id: workspace._id || workspace,
    code: populated ? workspace.code : null,
    name: populated ? workspace.name : null,
  };
};

const serializeAdmin = (admin) => ({
  _id: admin._id,
  name: admin.name,
  email: admin.email,
  enabled: admin.enabled === true,
  isActive: admin.isActive !== false,
  isSuperAdmin: admin.isSuperAdmin === true,
  modulePermissions: Array.isArray(admin.modulePermissions) ? admin.modulePermissions : [],
  workspace: serializeWorkspaceRef(admin.workspace),
  created: admin.created,
});

module.exports = serializeAdmin;
