/**
 * Gate for the /api/superadmin routes.
 *
 * This must always be mounted AFTER adminAuth.isValidAuthToken, which is what
 * populates req.admin. It does no token parsing of its own.
 *
 * The check is `!== true` rather than a truthy test so a missing, null or
 * malformed value denies access instead of allowing it.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.isSuperAdmin !== true) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Forbidden',
    });
  }

  next();
};

module.exports = requireSuperAdmin;
