export const fields = {
  name: {
    type: 'string',
    required: true,
  },
  mainContact: {
    type: 'search',
    renderAsTag: true,
    label: 'Contact',
    entity: 'people',
    redirectLabel: 'Add New Person',
    withRedirect: true,
    urlToRedirect: '/people',
    displayLabels: ['firstname', 'lastname'],
    searchFields: 'firstname,lastname',
    dataIndex: ['mainContact', 'firstname'],
  },
  country: {
    type: 'country',
  },
  phone: {
    type: 'phone',
  },
  email: {
    type: 'email',
    required: true,
  },
  website: {
    type: 'url',
  },
  /**
   * Who inside the workspace owns this company.
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
  // legalName: {
  //   type: 'string',
  //   required: true,
  // },
  // hasParentCompany: {
  //   type: 'boolean',
  //   default: false,
  // },
  // parentCompany: { type: 'search', entity: 'company' },

  // people: [{ type: 'search', entity: 'people', mutliple: true }],

  // icon: {
  //   type: 'image',
  // },
  // logo: {
  //   type: 'image',
  // },
  // imageHeader: 'image',
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
  // bankCountry: {
  //   type: 'string',
  // },
  // companyRegNumber: {
  //   type: 'string',
  // },
  // companyTaxNumber: {
  //   type: 'string',
  // },
  // companyTaxId: {
  //   type: 'string',
  // },
  // companyRegId: {
  //   type: 'string',
  // },
  // securitySocialNbr: 'string',
  // customField: [
  //   {
  //     fieldName: {
  //       type: 'string',

  //
  //     },
  //     fieldType: {
  //       type: 'string',

  //
  //       default: 'string',
  //     },
  //     fieldValue: {},
  //   },
  // ],
  // location: {
  //   latitude: Number,
  //   longitude: Number,
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
  //   type: Number,
  // },

  // otherPhone: [
  //   {
  //     type: 'string',
  //   },
  // ],
  // fax: {
  //   type: 'string',
  // },

  // otherEmail: [
  //   {
  //     type: 'string',
  //   },
  // ],

  // socialMedia: {
  //   facebook: 'string',
  //   instagram: 'string',
  //   twitter: 'string',
  //   linkedin: 'string',
  //   tiktok: 'string',
  //   youtube: 'string',
  //   snapchat: 'string',
  // },
  // images: [
  //   {
  //     id: 'string',
  //     name: 'string',
  //     path: 'string',
  //     description: 'string',
  //     isPublic: {
  //       type: 'boolean',
  //       default: false,
  //     },
  //   },
  // ],
  // files: [
  //   {
  //     id: 'string',
  //     name: 'string',
  //     path: 'string',
  //     description: 'string',
  //     isPublic: {
  //       type: 'boolean',
  //       default: false,
  //     },
  //   },
  // ],
  // category: 'string',
  // approved: {
  //   type: 'boolean',
  //   default: true,
  // },
  // verified: {
  //   type: 'boolean',
  // },
  // notes: {
  //   type: 'string',
  // },
};
