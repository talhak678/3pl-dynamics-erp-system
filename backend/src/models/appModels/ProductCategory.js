const mongoose = require('mongoose');

const productCategorySchema = new mongoose.Schema({
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
   * Authorship: which account entered this category.
   *
   * `createdBy` above holds the TENANT, which every tenancy filter in the app
   * matches on, so it cannot also name a person - for anyone but the workspace
   * owner those are two different ids.
   *
   * This field does NOT narrow anybody's view of the catalogue. ProductCategory
   * is deliberately absent from SCOPED_MODEL_NAMES, so a child account still
   * reads every category in the workspace and the category picker on the product
   * form stays full. What it exists for is the workspace owner's "Filter by
   * User" control: an owner can ask to see only the categories one colleague
   * entered. See userFilter in middlewares/ownership.js.
   *
   * There is no `assignedTo` beside it, and that is the difference between this
   * model and the eleven that carry both. Assignment exists to hand a record to
   * one person and hide it from everyone else; the catalogue is shared, so there
   * is nothing to hand over and no "Assign To" control on this form.
   */
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  name: {
    type: String,
    required: true,
  },
  description: String,
  color: {
    type: String,
    lowercase: true,
    trim: true,
    required: true,
  },
  hasParentCategory: {
    type: Boolean,
    default: false,
  },
  parentCategory: {
    type: mongoose.Schema.ObjectId,
    ref: 'ProductCategory',
  },

  title: String,
  tags: [String],
  icon: String,
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

module.exports = mongoose.model('ProductCategory', productCategorySchema);
