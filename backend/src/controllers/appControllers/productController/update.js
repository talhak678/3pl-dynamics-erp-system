const mongoose = require('mongoose');

const updateRecord = require('../../middlewaresControllers/createCRUDController/update');
const { scopedFilter } = require('../../../middlewares/ownership');
const { resolveProductImages, dropReplacedImages } = require('../../../utils/productImages');

const Model = mongoose.model('Product');

/**
 * Update a product, with its photos.
 *
 * Same shape as create: resolve the images, then hand the request to the shared
 * update so ownership, authorship and delegation keep behaving the way they do
 * everywhere else.
 *
 * The extra step is the cleanup. A save that swaps a photo leaves the old one
 * with nothing pointing at it, and unlike an abandoned form - which never writes
 * anything, because photos are only stored when their product is saved - that
 * one is a real row. It is removed after the response has been written, and only
 * when that response says the save succeeded: deleting first would leave a failed
 * update naming bytes that no longer exist, which is a broken product photo in
 * exchange for saving a row.
 */
const update = async (req, res) => {
  const previous = await Model.findOne({
    _id: req.params.id,
    removed: false,
    ...scopedFilter(Model, req),
  })
    .select('coverImage galleryImages')
    .exec();

  const resolved = await resolveProductImages(req);

  if (resolved.error) {
    return res.status(400).json({
      success: false,
      result: null,
      message: resolved.error,
    });
  }

  if (previous) {
    res.on('finish', () => {
      if (res.statusCode !== 200) return;

      // The response is already sent, so a failure here cannot be reported to
      // anyone - but it must not be silent either, or the leak this exists to
      // prevent would be invisible.
      dropReplacedImages(previous, resolved).catch((error) => {
        console.error('Could not remove replaced product photos:', error.message);
      });
    });
  }

  return updateRecord(Model, req, res);
};

module.exports = update;
