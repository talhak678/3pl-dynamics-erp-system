import { API_BASE_URL } from '@/config/serverApiConfig';

/**
 * How many photographs a product's gallery holds, and therefore how many the
 * form will accept. The server enforces the same number - see
 * backend/src/utils/productImages.js - because a request does not have to come
 * from this form; this copy exists so the user is told before one is spent.
 */
export const MAX_GALLERY_IMAGES = 4;

/**
 * A stored photo as a URL an <img> can actually load.
 *
 * A product holds a token, not a URL and not the bytes: the image lives in its
 * own collection and is fetched from the route that serves it. Three shapes can
 * arrive in the field, though, and the difference matters -
 *
 *   - a token, which is a photograph already saved, and needs the route
 *     prefixing;
 *   - a data: URI, which is a photograph the browser has just compressed and
 *     which renders as it is, without a round trip;
 *   - an http or root-relative URL, passed through because it is already
 *     complete.
 *
 * Prefixing the latter two produces a URL that resolves to nothing and shows a
 * broken image, which is the failure this guards against - the same three-branch
 * shape as utils/avatar.js, for the same reason.
 *
 * Returns undefined rather than an empty string when there is nothing to show,
 * so callers can tell "no photograph" from "a photograph that failed to load"
 * and draw their own placeholder.
 */
export const productImageSrc = (value) => {
  if (!value || typeof value !== 'string') return undefined;
  if (value.startsWith('data:') || value.startsWith('http') || value.startsWith('/')) return value;
  return `${API_BASE_URL}product/image/${value}`;
};
