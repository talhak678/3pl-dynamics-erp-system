/**
 * Gate for the /api/team routes - the Customer Admin's own employee management.
 *
 * This must always be mounted AFTER adminAuth.isValidAuthToken, which is what
 * populates req.admin. It does no token parsing of its own.
 *
 * Only a tenant owner may manage the workspace's employees:
 *
 *   - an employee must not reach it, or they could grant themselves modules
 *     their employer deliberately withheld, or mint a sibling account;
 *   - a super admin must not reach it either. They own no tenant, so
 *     `req.admin._id` is not a workspace they could staff, and letting them in
 *     would mean the isolation filters below key off an id that owns nothing.
 *
 * `role` is a descriptive field everywhere else in this codebase and grants
 * nothing by itself - `isSuperAdmin` remains the authoritative control-plane
 * gate. Here it is read because "who may staff this workspace" genuinely is a
 * question about the account's role, and there is no other field that answers
 * it. The `isSuperAdmin` test is explicit rather than implied so that a super
 * admin who somehow also carried role 'owner' is still refused.
 */
const requireTenantOwner = (req, res, next) => {
  const admin = req.admin;

  if (!admin || admin.isSuperAdmin === true || admin.role !== 'owner') {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Forbidden',
    });
  }

  next();
};

module.exports = requireTenantOwner;
