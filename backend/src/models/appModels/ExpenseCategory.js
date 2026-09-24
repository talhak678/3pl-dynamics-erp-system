const mongoose = require('mongoose');

const expenseCategorySchema = new mongoose.Schema({
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
   * Authorship and assignment - the two halves of the child-account read scope.
   *
   * `createdBy` above holds the TENANT this record belongs to, which every
   * tenancy filter in the app matches on, so it cannot also name a person: for
   * anyone but the workspace owner those are two different ids. These two are
   * the person-shaped fields, and middlewares/ownership.js is where they become
   * a query - a child account sees a category it entered OR one assigned to it,
   * and the workspace owner sees everything.
   *
   * A narrowed category tree empties the Expense form's category picker for
   * anyone the owner has not delegated to, so the Assign To control on this
   * entity's form is what keeps that form usable - see utils/assignee.js for
   * the write rule it feeds.
   */
  createdByUser: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
  assignedTo: { type: mongoose.Schema.ObjectId, ref: 'Admin' },

  name: {
    type: String,
    trim: true,
    required: true,
  },
  description: {
    type: String,
    trim: true,
    required: true,
  },
  color: {
    type: String,
    lowercase: true,
    trim: true,
    required: true,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
