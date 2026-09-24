export const fields = {
  firstname: {
    type: 'string',
    required: true,
  },
  lastname: {
    type: 'string',
    required: true,
  },
  company: {
    type: 'search',
    entity: 'company',
    renderAsTag: true,
    redirectLabel: 'Add New Company',
    withRedirect: true,
    urlToRedirect: '/company',
    displayLabels: ['name'],
    searchFields: 'name',
    dataIndex: ['company', 'name'],
  },
  country: {
    type: 'country',
  },
  phone: {
    type: 'phone',
  },
  email: {
    type: 'email',
  },
  /**
   * Who inside the workspace owns this person.
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
  // bio: {
  //   type: 'string',
  // },
  // idCardNumber: {
  //   type: 'string',
  // },
  // idCardType: {
  //   type: 'string',
  // },
  // securitySocialNbr: {
  //   type: 'string',
  // },
  // taxNumber: {
  //   type: 'string',
  // },
  // birthday: {
  //   type: 'date',
  // },
  // birthplace: {
  //   type: 'string',
  // },
  // gender: {
  //   type: 'select',
  //   options: [
  //     {
  //       value: 'male',
  //       label: 'Male',
  //     },
  //     {
  //       value: 'female',
  //       label: 'Female',
  //     },
  //   ],
  // },
  // bankName: {
  //   type: 'string',
  // },
  // bankIban: {
  //   type: 'string',
  // },
  // bankSwift: {
  //   type: 'string',
  // },
  // bankNumber: {
  //   type: 'string',
  // },
  // bankRouting: {
  //   type: 'string',
  // },
  // address: {
  //   type: 'string',
  // },
  // city: {
  //   type: 'string',
  // },
  // State: {
  //   type: 'string',
  // },
  // postalCode: {
  //   type: 'number',
  // },
  // website: {
  //   type: 'string',
  // },
};
