/**
 * Normalises an employee Admin document into the shape the team API exposes.
 *
 * An explicit whitelist rather than returning the document, so a field added to
 * the Admin schema later cannot leak into this response by accident. That
 * matters more here than on the super admin's equivalent, because this payload
 * crosses between two accounts of the same tenant: `parentAdminId` is omitted
 * so an employee's response never carries the id used to scope queries, and no
 * credential material from AdminPassword is reachable from here at all.
 */
const serializeMember = (member) => ({
  _id: member._id,
  name: member.name,
  surname: member.surname,
  email: member.email,
  photo: member.photo,
  role: member.role,
  isActive: member.isActive !== false,
  modulePermissions: Array.isArray(member.modulePermissions) ? member.modulePermissions : [],
  created: member.created,
});

module.exports = serializeMember;
