const mongoose = require('mongoose');
const Joi = require('joi');
const { generate: uniqueId } = require('shortid');

const { validateRequestedModules, grantableModules } = require('./permissions');
const serializeMember = require('./serializeMember');

/**
 * POST /api/team
 *
 * Creates an employee inside the calling owner's workspace.
 *
 * `role`, `isSuperAdmin` and `parentAdminId` are all set here and never read
 * from the request body:
 *
 *   parentAdminId  is what scopes every later query, so accepting it from the
 *                  client would let an owner plant an account inside another
 *                  tenant - or, worse, let the account choose its own parent.
 *   isSuperAdmin   is left false so this endpoint cannot mint a control-plane
 *                  account, exactly as the super admin's own createUser does.
 *   role           is fixed to 'employee'. The only role this endpoint may
 *                  produce is one that cannot reach this endpoint.
 *
 * `enabled` is set true because its schema default is false and a new account
 * would otherwise be refused at login.
 */
const createMember = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const { name, surname, email, password, modulePermissions, isActive } = req.body;

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

  const permissions = validateRequestedModules(modulePermissions, req.admin);

  if (permissions.error) {
    return res.status(permissions.status).json({
      success: false,
      result: null,
      message: permissions.error,
      // Echoed so the client can offer exactly the modules this owner holds,
      // rather than a hardcoded list that could disagree with the server.
      grantableModules: grantableModules(req.admin),
    });
  }

  const normalisedEmail = email.trim().toLowerCase();

  // Checked globally rather than within the workspace, because email is the
  // login key: two accounts sharing one address would make sign-in ambiguous
  // and one tenant's employee could be resolved to another tenant's account.
  const existingAdmin = await Admin.findOne({ email: normalisedEmail, removed: false });

  if (existingAdmin) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'An account with this email already exists',
    });
  }

  const member = await new Admin({
    name,
    surname,
    email: normalisedEmail,
    enabled: true,
    isActive: isActive === undefined ? true : isActive === true,
    isSuperAdmin: false,
    role: 'employee',
    parentAdminId: req.admin._id,
    modulePermissions: permissions.value,
  }).save();

  const salt = uniqueId();
  const passwordHash = new AdminPassword().generateHash(salt, password);

  await new AdminPassword({
    password: passwordHash,
    emailVerified: true,
    salt,
    user: member._id,
  }).save();

  return res.status(200).json({
    success: true,
    result: serializeMember(member),
    message: 'User created successfully',
  });
};

module.exports = createMember;
