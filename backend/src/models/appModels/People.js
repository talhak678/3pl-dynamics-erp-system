const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: true,
  },

  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },

  /**
   * The account that entered this record, as distinct from `createdBy` above,
   * which holds the TENANT it belongs to.
   *
   * Every tenancy filter in the app is `createdBy: <tenant id>`, so that field
   * cannot also name a person: for anyone but the workspace owner those are two
   * different ids. The owner's "show me only this person's rows" filter is a
   * question about a person, so it needs a field of its own. See
   * middlewares/ownership.js, which only applies that filter to models carrying
   * this path.
   *
   * Null on records that predate it. Those stay visible to the owner and are
   * simply not matched by a per-user filter, which is the safe direction to fail
   * in.
   */
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  /**
   * The account this record was handed to, if the workspace owner delegated it.
   *
   * The second half of the child-account read scope: a person is visible to the
   * account that entered it OR to the account it was assigned to, and to nobody
   * else. See middlewares/ownership.js, which is where that rule lives and which
   * names this model among the ones it narrows.
   *
   * Only the workspace owner may set it. Anyone else sending the field has it
   * dropped before the write - see utils/assignee.js.
   */
  assignedTo: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  firstname: {
    type: String,
    trim: true,
    required: true,
  },
  lastname: {
    type: String,
    trim: true,
    required: true,
  },
  isClient: {
    type: Boolean,
    default: false,
  },
  company: { type: mongoose.Schema.ObjectId, ref: 'Company' },
  bio: String,
  idCardNumber: {
    type: String,
    trim: true,
  },
  idCardType: {
    type: String,
  },
  securitySocialNbr: {
    type: String,
  },
  taxNumber: {
    type: String,
  },
  birthday: {
    type: Date,
  },
  birthplace: {
    type: String,
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
  },
  photo: {
    type: String,
  },
  bankName: {
    type: String,
    trim: true,
  },
  bankIban: {
    type: String,
    trim: true,
  },
  bankSwift: {
    type: String,
    trim: true,
  },
  bankNumber: {
    type: String,
    trim: true,
  },
  bankRouting: {
    type: String,
    trim: true,
  },
  customField: [
    {
      fieldName: {
        type: String,
        trim: true,
        lowercase: true,
      },
      fieldType: {
        type: String,
        trim: true,
        lowercase: true,
        default: 'string',
      },
      fieldValue: {},
    },
  ],
  location: {
    latitude: Number,
    longitude: Number,
  },
  address: {
    type: String,
  },
  city: {
    type: String,
  },
  State: {
    type: String,
  },
  postalCode: {
    type: Number,
  },
  country: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  otherPhone: [
    {
      type: String,
      trim: true,
    },
  ],
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },

  otherEmail: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String,
    linkedin: String,
    tiktok: String,
    youtube: String,
    snapchat: String,
  },
  website: {
    type: String,
    trim: true,
    lowercase: true,
  },
  images: [
    {
      id: String,
      name: String,
      path: String,
      description: String,
      isPublic: {
        type: Boolean,
        default: false,
      },
    },
  ],
  files: [
    {
      id: String,
      name: String,
      path: String,
      description: String,
      isPublic: {
        type: Boolean,
        default: false,
      },
    },
  ],
  notes: String,
  category: String,
  status: String,
  approved: {
    type: Boolean,
  },
  verified: {
    type: Boolean,
  },
  tags: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],
  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
});

schema.plugin(require('mongoose-autopopulate'));
module.exports = mongoose.model('People', schema);
