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
  //
  // No jwtExpired flag here, deliberately. This is a failed sign-in attempt, not
  // an expired session: there are no credentials to tear down, and setting the
  // flag would send the client looking for a session to end. The message alone
  // is enough — the sign-in form shows it without any redirect.
  if (user.isActive === false) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Account Suspended, please contact our support team',
    });
  }

  // An employee's access is only as live as the employer that granted it. The
  // per-request kill switch in isValidAuthToken covers the employee's own
  // `isActive`, but nothing there looks at the account above them — so without
  // this an employee of a suspended company keeps signing in and working on
  // that company's data until their own token expires.
  //
  // Checked at login rather than per request deliberately: it costs one query
  // on a path that already makes three, and putting it in the middleware would
  // add a lookup to every single API call.
  if (user.parentAdminId) {
    const employer = await UserModel.findOne({
      _id: user.parentAdminId,
      removed: false,
    });

    // A missing employer means the workspace this account belonged to is gone,
    // so there is nothing left for it to sign in to.
    if (!employer) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'This account is no longer part of an active workspace.',
      });
    }

    if (employer.isActive === false || !employer.enabled) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Account Suspended, please contact your account administrator',
      });
    }
  }

  // Strict isolation means a tenant owns their settings outright. Give them
  // their private copy of the defaults on first login so invoices, quotes and
  // PDFs keep working. Best effort - it must never block authentication.
  // Super admins are control-plane only and own no tenant data, so there is
  // nothing to seed for them.
  //
  // Keyed on the tenant rather than the account: an employee stores no settings
  // of their own, so seeding under their id would create an orphaned set that
  // nothing ever reads, while the company's real settings sat untouched.
  if (user.isSuperAdmin !== true) {
    await ensureTenantSettings(user.tenantId);
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
