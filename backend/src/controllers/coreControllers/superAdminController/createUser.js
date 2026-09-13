const mongoose = require('mongoose');
const Joi = require('joi');
const { generate: uniqueId } = require('shortid');

const { isValidModuleKey } = require('../../../utils/moduleList');
const serializeAdmin = require('./serializeAdmin');

/**
 * POST /api/superadmin/users
 *
 * Creates a tenant account.
 *
 * `isSuperAdmin` is deliberately not read from the request body, so this
 * endpoint cannot be used to mint a second super admin. `enabled` and
 * `isActive` are both set server-side: `enabled` because its schema default is
 * false and would otherwise lock the new account out of login, `isActive`
 * because it must not be client-settable.
 */
const createUser = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const { name, email, password, modulePermissions } = req.body;

  // `name` is required by the Admin schema, so it is required here too.
  const objectSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .required(),
    password: Joi.string().min(8).required(),
  });

  const { error } = objectSchema.validate({ name, email, password });

  if (error) {
    return res.status(400).json({
      success: false,
      result: null,
      error,
      message: error.message,
    });
  }

  // Omitted means "all modules", which is the empty allow-list.
  const requestedModules = modulePermissions === undefined ? [] : modulePermissions;

  if (!Array.isArray(requestedModules)) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'modulePermissions must be an array of module keys',
    });
  }

  const unknownModules = requestedModules.filter((key) => !isValidModuleKey(key));

  if (unknownModules.length > 0) {
    return res.status(400).json({
      success: false,
      result: null,
      message: `Unknown module key(s): ${unknownModules.join(', ')}`,
    });
  }

  const normalisedEmail = email.trim().toLowerCase();

  const existingAdmin = await Admin.findOne({ email: normalisedEmail, removed: false });

  if (existingAdmin) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'An account with this email already exists',
    });
  }

  const admin = await new Admin({
    name,
    email: normalisedEmail,
    enabled: true,
    isActive: true,
    isSuperAdmin: false,
    modulePermissions: requestedModules,
  }).save();

  const salt = uniqueId();
  const passwordHash = new AdminPassword().generateHash(salt, password);

  await new AdminPassword({
    password: passwordHash,
    emailVerified: true,
    salt,
    user: admin._id,
  }).save();

  // No settings documents are created here. ensureTenantSettings() seeds the
  // tenant's private settings copy on their first login.

  return res.status(200).json({
    success: true,
    result: serializeAdmin(admin),
    message: 'User created successfully',
  });
};

module.exports = createUser;
