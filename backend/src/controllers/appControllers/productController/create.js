const mongoose = require('mongoose');

const createRecord = require('../../middlewaresControllers/createCRUDController/create');
const { resolveProductImages } = require('../../../utils/productImages');

const Model = mongoose.model('Product');

/**
 * Create a product, with its photos.
 *
 * Wraps the shared implementation rather than replacing it: the photos are
 * resolved into tokens first, and then everything that makes a record a record -
 * which tenant owns it, who wrote it, whether it may be assigned - happens in
 * exactly one place, the same one every other entity uses.
 *
 * The cover is required here and not in the shared path, because "at least one
 * image per product" is a rule about products, not about the act of creating
 * something.
 */
const create = async (req, res) => {
  const resolved = await resolveProductImages(req, { requireCover: true });

  if (resolved.error) {
    return res.status(400).json({
      success: false,
      result: null,
      message: resolved.error,
    });
  }

  return createRecord(Model, req, res);
};

module.exports = create;
