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
 *
 * `workspace` IS required, and is the one thing this endpoint asks the caller to
 * choose. An account cannot be provisioned without one: the workspace must
 * already exist and be active, so the Super Admin has to create the workspace
 * before the account that belongs to it. Only its id is taken from the body -
 * the document is looked up and the id written from that lookup, so a body
 * cannot attach an account to a workspace that is not there to be attached to.
 */
const createUser = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');
  const Workspace = mongoose.model('Workspace');

  const { name, email, password, modulePermissions, workspace } = req.body;

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

  // The workspace is checked before the email, so that an omitted or unusable
  // one is reported as what it is rather than being masked by a duplicate-email
  // conflict that happens to be true as well.
  //
  // Checked here rather than by a `required` on the Admin schema because this is
  // the only path where a workspace is a decision the caller makes; see the
  // comment on `Admin.workspace`.
  if (!workspace || !mongoose.Types.ObjectId.isValid(workspace)) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'A workspace must be selected to create an account',
    });
  }

  // Must be an ACTIVE workspace. Filtering here rather than trusting the id the
  // client sent is what stops a stale dropdown, or a hand-made request, from
  // provisioning an account against a customer who has been deactivated.
  const workspaceDoc = await Workspace.findOne({
    _id: workspace,
    removed: false,
    isActive: true,
  }).exec();

  if (!workspaceDoc) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'The selected workspace is not available',
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
    // Written explicitly rather than left to the schema default. `role` decides
    // who may manage a team, so a tenant account created here has to be an owner
    // by construction - not by a default that a future edit could move.
    role: 'owner',
    parentAdminId: null,
    workspace: workspaceDoc._id,
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
