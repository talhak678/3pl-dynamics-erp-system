import { FILE_BASE_URL } from '@/config/serverApiConfig';

/**
 * A stored photo as a URL an <img> can actually load.
 *
 * Two shapes arrive in this field depending on how the account was created: a
 * filename on the file host, which needs the base prefixing, and a data: or
 * http URL, which must not be - prefixing one of those produces a URL that
 * resolves to nothing and renders as a broken image rather than as initials.
 *
 * Returns undefined rather than an empty string when there is no photo, because
 * that is what tells an Ant Design Avatar to fall back to the initials passed as
 * its children. An empty string is a src, and a src that fails is not the same
 * thing.
 *
 * Extracted because the same three-branch expression had been written out at
 * every site that shows a person. The risk it removes is not the repetition but
 * the near-miss: a copy that drops the http branch shows a broken image for
 * every account with an uploaded avatar, and only for those.
 */
export const avatarSrc = (person) => {
  if (!person?.photo) return undefined;
  if (person.photo.startsWith('data:') || person.photo.startsWith('http')) return person.photo;
  return `${FILE_BASE_URL}${person.photo}`;
};

/**
 * The initials an Avatar shows when there is no picture.
 *
 * Two characters at most, taken from the first two words, so "Sales Executive
 * Team" is "SE" rather than "SET" - and so a long name does not overflow the
 * circle. A name that is entirely punctuation or spaces yields an empty string,
 * which the Avatar renders as an empty circle; that is the honest outcome for a
 * value with no readable characters in it.
 */
export const initialsOf = (name) =>
  String(name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
