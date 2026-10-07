/**
 * Normalises a Workspace document into the shape the Super Admin API exposes.
 *
 * An explicit whitelist rather than returning the document, matching
 * serializeAdmin, so a field added to the schema later cannot reach a client by
 * accident.
 *
 * `isActive` is compared against exact values rather than read straight off, so
 * a document written before the field existed reads back with its intended
 * default instead of depending on Mongoose applying one to a projected path.
 */
const serializeWorkspace = (workspace) => ({
  _id: workspace._id,
  code: workspace.code,
  name: workspace.name,
  customerName: workspace.customerName || '',
  customerEmail: workspace.customerEmail || '',
  customerPhone: workspace.customerPhone || '',
  isActive: workspace.isActive !== false,
  created: workspace.created,
});

module.exports = serializeWorkspace;
