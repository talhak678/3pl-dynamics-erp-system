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
   * Authorship: which account entered this product.
   *
   * `createdBy` above holds the TENANT, which every tenancy filter in the app
   * matches on, so it cannot also name a person - for anyone but the workspace
   * owner those are two different ids.
   *
   * This field does NOT narrow anybody's view of the catalogue. Product is
   * deliberately absent from SCOPED_MODEL_NAMES, so a child account still reads
   * every product in the workspace and the pickers on the invoice, quote and
   * order forms stay full. What it exists for is the workspace owner's "Filter
   * by User" control: an owner can ask to see only the products one colleague
   * entered. See userFilter in middlewares/ownership.js.
   *
   * There is no `assignedTo` beside it, and that is the difference between this
   * model and the eleven that carry both. Assignment exists to hand a record to
   * one person and hide it from everyone else; the catalogue is shared, so there
   * is nothing to hand over and no "Assign To" control on the product form.
   */
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  productCategory: {
    type: mongoose.Schema.ObjectId,
    ref: 'ProductCategory',
    required: true,
    autopopulate: true,
  },
  suppliers: [{ type: mongoose.Schema.ObjectId, ref: 'Supplier' }],
  name: {
    type: String,
    required: true,
  },
  description: String,
  number: {
    type: Number,
  },
  title: String,
  tags: [String],
  headerImage: String,
  photo: String,
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
  priceBeforeTax: {
    type: Number,
  },
  taxRate: { type: Number, default: 0 },
  price: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'NA',
    uppercase: true,
    required: true,
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
    default: true,
  },
});

schema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('Product', schema);
