export const fields = {
  name: {
    type: 'string',
    required: true,
  },
  expenseCategory: {
    type: 'async',
    label: 'Expense Category',
    displayLabels: ['expenseCategory', 'name'],
    dataIndex: ['expenseCategory', 'name'],
    entity: 'expensecategory',
    required: true,
  },

  total: {
    type: 'currency',
    required: true,
  },
  description: {
    type: 'textarea',
  },
  ref: {
    type: 'string',
  },
  /**
   * Who inside the workspace owns this expense.
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
