import color from '@/utils/color';

export const fields = {
  name: {
    type: 'stringWithColor',
    required: true,
  },
  description: {
    type: 'textarea',
    required: true,
  },
  color: {
    type: 'color',
    options: [...color],
    required: true,
  },
  enabled: {
    type: 'boolean',
    required: true,
  },
  /**
   * Who inside the workspace owns this category.
   *
   * `type: 'assignee'` is handled by components/AssigneeSelect, which fetches
   * /api/team and renders nothing at all for an account that may not assign -
   * only the workspace owner may, and the server drops the field from anyone
   * else's write. See utils/assignee.js on the backend.
   *
   * Not merely a nicety on this entity. Expense categories are tenant-scoped, so
   * a child account sees only the categories it created or was given - which
   * empties the expense form's category picker for anyone the owner has not
   * delegated to. This control is what keeps that form usable.
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
