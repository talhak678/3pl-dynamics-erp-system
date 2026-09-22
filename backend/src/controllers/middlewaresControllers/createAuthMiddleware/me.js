const { resolveModules } = require('../../../utils/moduleList');

/**
 * GET /api/auth/me — the calling account's own profile.
 *
 * Exists so a signed-in client can re-read its own permissions without signing
 * out and back in. A Customer Admin who changes an employee's module grants has
 * changed a row the employee's browser is holding a stale copy of: the sidebar,
 * the route guards and every module check read `modulePermissions` from the
 * stored session, and that session lives as long as the token does. This is the
 * endpoint that lets the client refresh that copy on load.
 *
 * The shape is authUser's result deliberately, minus the two fields that only
 * describe a fresh sign-in. It has to be a mirror rather than a new invention:
 * the client merges the reply over the session it already holds, so any field
 * named differently here, or omitted, would not update - it would leave the old
 * value in place and look like the sync had worked. `token` and `maxAge` are the
 * exceptions and are left out on purpose: the caller already has a working token
 * (it is what authenticated this request), and returning one would invite a
 * client to overwrite it with a fresh JWT on every page load, quietly turning a
 * 24-hour session into one that never ends.
 *
 * `resolveModules` is applied here for the same reason login applies it, and it
 * is the reason this endpoint cannot simply return the document: an empty
 * `modulePermissions` array means EVERY module, and the client must never have
 * to know that rule. It receives the resolved list or nothing.
 *
 * No controller-specific authorisation is needed. isValidAuthToken has already
 * refused a missing, forged, revoked or suspended session before this runs, and
 * what it leaves in req.admin is the account the token names - so this can only
 * ever describe the caller to themselves. There is no id parameter to tamper
 * with, which is what keeps it from becoming a way to read another account.
 */
const me = async (req, res) => {
  const admin = req.admin;

  return res.status(200).json({
    success: true,
    result: {
      _id: admin._id,
      name: admin.name,
      surname: admin.surname,
      role: admin.role,
      email: admin.email,
      photo: admin.photo,
      isSuperAdmin: admin.isSuperAdmin === true,
      modulePermissions: resolveModules(admin),
    },
    message: 'Successfully fetched current user',
  });
};

module.exports = me;
