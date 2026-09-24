export const fields = {
  name: {
    type: 'string',
  },
  country: {
    type: 'country',
    // color: 'red',
  },
  address: {
    type: 'string',
  },
  phone: {
    type: 'phone',
  },
  email: {
    type: 'email',
  },
  /**
   * Who inside the workspace owns this client.
   *
   * `type: 'assignee'` is handled by components/AssigneeSelect, which fetches
   * /api/team and renders nothing at all for an account that may not assign -
   * only the workspace owner may, and the server drops the field from anyone
   * else's write. See utils/assignee.js on the backend.
   *
   * `disableForTable` because utils/dataStructure.jsx turns every field into a
   * column unless it is set, and this one holds a bare ObjectId.
   */
  assignedTo: {
    type: 'assignee',
    label: 'Assign To',
    disableForTable: true,
  },
};
