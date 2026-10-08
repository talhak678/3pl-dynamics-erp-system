const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * The bytes of one product photo.
 *
 * A collection of its own rather than a field on Product, for one reason: the
 * products list returns whole documents, so a page of ten rows drawing one
 * thumbnail each would ship ten megabytes of base64 to draw ten small squares.
 * The product holds a token, this holds the bytes, and an image is fetched by
 * URL only where something actually shows it.
 *
 * Tenancy follows the rest of the app - one shared database, with `createdBy`
 * holding the tenant, set from `req.admin.tenantId` on write. It is checked
 * again when an existing token is attached to a product, so a workspace cannot
 * pin another workspace's photo onto its own catalogue entry.
 *
 * This lives in coreModels rather than appModels deliberately: models/utils
 * builds a full CRUD route for every appModel, and this is internal storage with
 * no page and no user-editable fields. `Upload` sits here for the same reason.
 */
const productImageSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
    /**
     * 128 bits of randomness rather than the ObjectId.
     *
     * The route that serves these bytes cannot be authenticated: the frontend
     * sends its token in an Authorization header, and an <img src> has no way to
     * send one - see routes/coreRoutes/productImageRouter.js. So the URL itself
     * is what protects the photo, and it needs to be something that cannot be
     * walked. An ObjectId encodes a timestamp, a machine and a counter, which
     * makes it enumerable in a way this is not.
     */
    default: () => crypto.randomBytes(16).toString('hex'),
  },
  // The complete `data:<mime>;base64,<payload>` URI, exactly as the browser
  // produced it. Stored whole rather than as raw base64 so the mime type cannot
  // drift away from the bytes it describes.
  data: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  // Decoded byte length, kept for the same reason any other measured field is:
  // asking "how much of this workspace's storage is photos" should not mean
  // loading every photo.
  size: {
    type: Number,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ProductImage', productImageSchema);
