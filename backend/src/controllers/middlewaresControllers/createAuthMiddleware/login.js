const Joi = require('joi');

const mongoose = require('mongoose');

const authUser = require('./authUser');
const { ensureTenantSettings } = require('../../../middlewares/settings');

const login = async (req, res, { userModel }) => {
  const UserPasswordModel = mongoose.model(userModel + 'Password');
  const UserModel = mongoose.model(userModel);
  const { email, password } = req.body;

  // validate
  const objectSchema = Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .required(),
    password: Joi.string().required(),
  });

  const { error, value } = objectSchema.validate({ email, password });
  if (error) {
    return res.status(409).json({
      success: false,
      result: null,
      error: error,
      message: 'Invalid/Missing credentials.',
      errorMessage: error.message,
    });
  }

  const user = await UserModel.findOne({ email: email, removed: false });

  // console.log(user);
  if (!user)
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No account with this email has been registered.',
    });

  const databasePassword = await UserPasswordModel.findOne({ user: user._id, removed: false });

  if (!user.enabled)
    return res.status(409).json({
      success: false,
      result: null,
      message: 'Your account is disabled, contact your account adminstrator',
    });

  // Kill switch. Checked against exactly `false` so a document that predates
  // the field is not mistaken for a suspended account.
  if (user.isActive === false) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Account suspended',
    });
  }

  // Strict isolation means a tenant owns their settings outright. Give them
  // their private copy of the defaults on first login so invoices, quotes and
  // PDFs keep working. Best effort - it must never block authentication.
  // Super admins are control-plane only and own no tenant data, so there is
  // nothing to seed for them.
  if (user.isSuperAdmin !== true) {
    await ensureTenantSettings(user._id);
  }

  //  authUser if your has correct password
  authUser(req, res, {
    user,
    databasePassword,
    password,
    UserPasswordModel,
  });
};

module.exports = login;
