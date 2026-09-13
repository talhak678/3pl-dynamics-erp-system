const mongoose = require('mongoose');
const { generate: uniqueId } = require('shortid');

/**
 * One-time creation of the first Super Admin account.
 *
 * Usage (after deploying, with both env vars set):
 *   GET /api/bootstrap-superadmin?secret=<BOOTSTRAP_SECRET>
 *
 * This route strictly CREATES one new account. It never reads, updates or
 * deletes any existing Admin, AdminPassword or tenant document. It is
 * idempotent and refuses to run again once a super admin exists.
 *
 * DELETE THIS FILE AND ITS ROUTE once the account has been created. The
 * removal checklist is in docs/superpowers/specs/2026-09-14-super-admin-design.md §9.
 */

const SUPER_ADMIN_EMAIL = 'superadmin@3pldynamicsai.com';

const bootstrapSuperAdmin = async (req, res) => {
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
  const bootstrapPassword = process.env.SA_BOOTSTRAP_PASSWORD;

  // Both variables are required. The password in particular is never hardcoded,
  // so no credential enters the repository.
  if (!bootstrapSecret || !bootstrapPassword) {
    return res.status(503).json({
      success: false,
      result: null,
      message:
        'BOOTSTRAP_SECRET and SA_BOOTSTRAP_PASSWORD must both be configured on this deployment.',
    });
  }

  if (req.query.secret !== bootstrapSecret) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Forbidden',
    });
  }

  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const existingSuperAdmin = await Admin.findOne({ isSuperAdmin: true, removed: false });

  if (existingSuperAdmin) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'A super admin already exists. This route is single-use.',
    });
  }

  const existingEmail = await Admin.findOne({ email: SUPER_ADMIN_EMAIL, removed: false });

  if (existingEmail) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'An account with the super admin email already exists.',
    });
  }

  const admin = await new Admin({
    name: 'Super Admin',
    email: SUPER_ADMIN_EMAIL,
    enabled: true,
    isActive: true,
    isSuperAdmin: true,
  }).save();

  const salt = uniqueId();
  const passwordHash = new AdminPassword().generateHash(salt, bootstrapPassword);

  try {
    await new AdminPassword({
      password: passwordHash,
      emailVerified: true,
      salt,
      user: admin._id,
    }).save();
  } catch (error) {
    // Do not leave a credential-less admin behind if the password write fails.
    await Admin.deleteOne({ _id: admin._id });
    throw error;
  }

  // No settings documents are created. A super admin owns no tenant data.

  return res.status(200).json({
    success: true,
    result: {
      _id: admin._id,
      email: admin.email,
      isSuperAdmin: true,
    },
    message: 'Super admin created successfully',
  });
};

module.exports = bootstrapSuperAdmin;
