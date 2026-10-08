const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const ProductImage = mongoose.model('ProductImage');

/**
 * One product photo, by its token.
 *
 * This route is public, and that is a consequence of how the frontend
 * authenticates rather than a choice about how sensitive a product photo is. The
 * app sends its session token in an Authorization header, and an <img src>
 * cannot send headers - so an authenticated image route would be one the browser
 * has no way to reach, and every thumbnail in the products table would need a
 * fetch, a blob URL and a cache of its own to work around it.
 *
 * What protects the bytes instead is the token: 128 random bits, minted per
 * upload, never reused, and only ever handed out inside the workspace's own
 * product records - the products list is tenant-scoped, so a token reaches the
 * accounts that can already see the product it belongs to. Tokens cannot be
 * walked, and the route exposes nothing else about the image: not its product,
 * not its owner, not a listing.
 *
 * Mounted alongside coreAuthRouter, ahead of the routers behind
 * adminAuth.isValidAuthToken, which is where the app already keeps the handful
 * of routes that answer before a caller has been identified.
 */
router.route('/product/image/:token').get(async (req, res) => {
  try {
    const image = await ProductImage.findOne({ token: req.params.token })
      .select('data mimeType')
      .exec();

    if (!image) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Image not found',
      });
    }

    const base64 = image.data.slice(image.data.indexOf(',') + 1);

    res.setHeader('Content-Type', image.mimeType);
    // A token identifies one upload and is never reused for different bytes, so
    // this can be cached hard: the browser keeps the thumbnail for the life of
    // the products table, and a replaced photo arrives under a new URL.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    return res.send(Buffer.from(base64, 'base64'));
  } catch (error) {
    return res.status(500).json({
      success: false,
      result: null,
      message: error.message,
    });
  }
});

module.exports = router;
