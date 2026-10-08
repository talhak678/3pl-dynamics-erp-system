/**
 * Shrinking a photograph in the browser, before it is ever sent.
 *
 * This is not an optimisation, it is what makes the feature possible. The app
 * runs on Vercel, which gives a deployment no disk to write to and caps a
 * request body at 4.5MB, so a phone photograph cannot be posted as it comes off
 * the camera. The photograph is decoded, scaled and re-encoded here, in the tab
 * that has the original, and what leaves the browser is a few hundred kilobytes
 * that a JSON request can carry.
 *
 * It happens on selection rather than on submit so that the wait lands while the
 * user is still filling in the rest of the form, and so the form's own preview
 * shows what will actually be stored rather than the original.
 */

// Enough for a product photograph to stay sharp on a retina screen at the size
// the app shows it, which is the largest it is ever displayed at.
const MAX_DIMENSION = 1200;

// The point at which the encoder stops trying. Well inside the per-image cap the
// server enforces, with room for the third that base64 adds.
const TARGET_BYTES = 400 * 1024;

// Tried in order until the result fits. Most photographs are under the target at
// the first one, so the later qualities are for the awkward ones rather than the
// common case.
const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

const JPEG = 'image/jpeg';
const PNG = 'image/png';

/** Base64 carries four characters for every three bytes, plus the header. */
const approxBytes = (dataUri) =>
  Math.max(0, Math.floor(((dataUri.length - dataUri.indexOf(',') - 1) * 3) / 4));

/**
 * Decode the file into something drawable.
 *
 * `createImageBitmap` is preferred because it is told to honour the EXIF
 * orientation flag: a photograph taken in portrait on a phone carries its
 * rotation as metadata rather than in its pixels, and drawing it without that
 * flag is what puts a sideways product on the screen. Where the browser is too
 * old for the option - it throws rather than ignoring it - the plain <img> path
 * below decodes the same file with the browser's own orientation handling, which
 * is correct on anything current.
 */
const decode = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (error) {
      // Fall through to the element-based decode.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };

    image.src = url;
  });
};

/**
 * A selected file as a compressed data URI, ready to send.
 *
 * Rejects rather than resolving to something unusable, so the caller has one
 * place to report the problem to the user.
 */
export const compressImage = async (file) => {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Only image files can be added.');
  }

  const source = await decode(file);

  // Never enlarged: a small photograph is stored as it is, and only one larger
  // than the ceiling is scaled down to it.
  const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));

  const context = canvas.getContext('2d');
  const release = () => {
    if (typeof source.close === 'function') source.close();
  };

  const render = (background) => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  };

  render(null);

  // A PNG is kept as a PNG while it fits: it may carry transparency, which JPEG
  // cannot store at all, so converting one that does not need converting would
  // lose it for nothing.
  if (file.type === PNG) {
    const png = canvas.toDataURL(PNG);

    if (approxBytes(png) <= TARGET_BYTES) {
      release();
      return png;
    }
  }

  // JPEG has no alpha channel, so anything transparent in the source would come
  // out black. Painting the canvas white first is what turns that into the
  // background a photograph would have had anyway.
  render('#ffffff');

  let jpeg = canvas.toDataURL(JPEG, JPEG_QUALITIES[0]);

  for (const quality of JPEG_QUALITIES) {
    jpeg = canvas.toDataURL(JPEG, quality);
    if (approxBytes(jpeg) <= TARGET_BYTES) break;
  }

  release();

  return jpeg;
};
