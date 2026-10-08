const mongoose = require('mongoose');

const ProductImage = mongoose.model('ProductImage');

/**
 * The limits, stated once. The frontend enforces the same numbers so the user
 * is stopped before a request is spent on it, and the schema enforces them again
 * because a request does not have to come from the frontend.
 */
const MAX_GALLERY_IMAGES = 4;
const MAX_TOTAL_IMAGES = 5;
// Per image, decoded - not to be confused with Vercel's 4.5MB ceiling on the
// whole request body, which is why the browser compresses before sending.
// Five images at this cap stay comfortably inside that.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Only formats a browser can draw. `image/jpg` is not a real mime type but is
// accepted because some scanners and older tools emit it.
const DATA_URI = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const TOKEN = /^[a-f0-9]{32}$/;

const approxBytesOfBase64 = (base64) => Math.floor((base64.length * 3) / 4);

const asList = (value) => (Array.isArray(value) ? value : []);

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

const isDataUri = (value) => DATA_URI.test(value);

const isToken = (value) => TOKEN.test(value);

const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);

/**
 * Turn one submitted value into a stored photo's token.
 *
 * Three shapes reach here, and each means something different:
 *
 *   - a data URI, which is a photo the browser has just compressed and encoded.
 *     It becomes a row in ProductImage and the token comes back.
 *   - a token, which is a photo already saved on an earlier save of this record.
 *     It is passed through untouched - that is what makes editing the price of a
 *     product leave its photos completely alone.
 *   - anything else, including '', which is not an image.
 */
const storeDataUri = async (dataUri, tenantId) => {
  const [, mimeType, base64] = DATA_URI.exec(dataUri);
  const size = approxBytesOfBase64(base64);

  if (size > MAX_IMAGE_BYTES) {
    return { error: 'Each photo must be smaller than 2MB.' };
  }

  const created = await new ProductImage({
    data: dataUri,
    mimeType,
    size,
    createdBy: tenantId,
  }).save();

  return { token: created.token };
};

/**
 * Read the photos out of a product request body and write back what should be
 * stored.
 *
 * The browser does not upload anything: it sends the compressed image inline as
 * a data URI, alongside the ordinary JSON fields, and this turns those into rows
 * and replaces each one with its token. That is what keeps the frontend on the
 * same create/update path every other module uses - no multipart, no separate
 * upload step, and no orphaned rows for photos attached to a form that was then
 * abandoned, because a photo is only ever written here, at the moment its
 * product is saved.
 *
 * Mutates `req.body` in place, because that is what the shared create/update
 * implementations read. Returns `{ error }` when the request should be refused,
 * and otherwise the resolved tokens, which the update path needs in order to
 * tell which of the record's previous photos have just been replaced.
 */
const resolveProductImages = async (req, { requireCover = false } = {}) => {
  const body = req.body || {};
  const tenantId = req.admin ? req.admin.tenantId : undefined;

  // Whether each field was mentioned at all. An update that does not mention the
  // gallery must leave it alone, so this is tracked separately from "is empty" -
  // writing `[]` for an absent field would silently wipe the gallery every time
  // anything else about the product was saved.
  const hasCover = has(body, 'coverImage');
  const hasGallery = has(body, 'galleryImages');

  const cover = clean(body.coverImage);
  const gallery = asList(body.galleryImages).map(clean).filter(Boolean);

  if (requireCover && !cover) {
    return { error: 'A cover photo is required.' };
  }

  if (gallery.length > MAX_GALLERY_IMAGES) {
    return { error: `Up to ${MAX_GALLERY_IMAGES} gallery photos are allowed.` };
  }

  if ((cover ? 1 : 0) + gallery.length > MAX_TOTAL_IMAGES) {
    return { error: `A product can hold up to ${MAX_TOTAL_IMAGES} photos.` };
  }

  /* A token is only a reference, so it has to be checked before it is stored:
     without this, a request could attach a token that does not exist (a broken
     image with no way to tell why) or one belonging to another workspace (which
     would put someone else's photo on this catalogue entry). One query covers
     every token in the request, and the tenant is part of the filter rather than
     a check afterwards so there is no path that forgets it. */
  const offeredTokens = [cover, ...gallery].filter(isToken);

  if (offeredTokens.length) {
    const owned = await ProductImage.find({
      token: { $in: offeredTokens },
      createdBy: tenantId,
    })
      .select('token')
      .exec();

    const known = new Set(owned.map((image) => image.token));
    const unknown = offeredTokens.filter((token) => !known.has(token));

    if (unknown.length) {
      return { error: 'One of the selected photos is no longer available. Please re-select it.' };
    }
  }

  let coverToken = '';

  if (cover) {
    if (isDataUri(cover)) {
      const stored = await storeDataUri(cover, tenantId);
      if (stored.error) return stored;
      coverToken = stored.token;
    } else if (isToken(cover)) {
      coverToken = cover;
    } else {
      return { error: 'That cover photo could not be read. Please select it again.' };
    }
  }

  const galleryTokens = [];

  for (const value of gallery) {
    let token = value;

    if (isDataUri(value)) {
      const stored = await storeDataUri(value, tenantId);
      if (stored.error) return stored;
      token = stored.token;
    } else if (!isToken(value)) {
      return { error: 'One of the gallery photos could not be read. Please select it again.' };
    }

    // The same photo twice - once as the cover and once in the gallery, or twice
    // in the gallery - would be shown twice and stored once. The UI cannot
    // produce it (promoting a gallery photo moves it, it does not copy), so this
    // is here for a request that did not come from the UI.
    if (token === coverToken || galleryTokens.includes(token)) continue;

    galleryTokens.push(token);
  }

  if (hasCover) body.coverImage = coverToken;
  if (hasGallery) body.galleryImages = galleryTokens;

  return { coverToken, galleryTokens };
};

/**
 * Delete the photos a save has just replaced.
 *
 * Without this, changing a product's cover would leave the old image in the
 * collection forever, and it would do so on every edit - a slow leak with no
 * upper bound. The photos are only removed once the save has actually succeeded
 * (see productController/update.js), because deleting them first would leave a
 * failed save pointing at bytes that no longer exist.
 *
 * A photo still named by another product is not touched. The UI cannot share a
 * token between two products, so in practice this set is exactly the ones just
 * replaced - the check is here so that "replace" can never become "delete
 * something else's photo".
 */
const dropReplacedImages = async (previous, next) => {
  if (!previous) return 0;

  const before = [clean(previous.coverImage), ...asList(previous.galleryImages).map(clean)].filter(
    Boolean
  );
  const after = new Set([next.coverToken, ...next.galleryTokens].filter(Boolean));
  const replaced = before.filter((token) => !after.has(token));

  if (!replaced.length) return 0;

  const Product = mongoose.model('Product');
  const stillReferenced = await Product.find({
    _id: { $ne: previous._id },
    removed: false,
    $or: [{ coverImage: { $in: replaced } }, { galleryImages: { $in: replaced } }],
  })
    .select('coverImage galleryImages')
    .exec();

  const inUse = new Set();
  stillReferenced.forEach((product) => {
    inUse.add(clean(product.coverImage));
    asList(product.galleryImages).forEach((token) => inUse.add(clean(token)));
  });

  const orphans = replaced.filter((token) => !inUse.has(token));

  if (!orphans.length) return 0;

  const { deletedCount } = await ProductImage.deleteMany({ token: { $in: orphans } });

  return deletedCount || 0;
};

module.exports = {
  resolveProductImages,
  dropReplacedImages,
  MAX_GALLERY_IMAGES,
  MAX_TOTAL_IMAGES,
  MAX_IMAGE_BYTES,
};
