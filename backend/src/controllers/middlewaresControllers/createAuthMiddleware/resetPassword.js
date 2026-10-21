const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const Joi = require('joi');
const mongoose = require('mongoose');
const shortid = require('shortid');

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const invalidLink = {
  success: false,
  result: null,
  message: 'This password reset link is invalid or has expired. Please request a new one.',
};

const resetPassword = async (req, res, { userModel }) => {
  const UserPassword = mongoose.model(userModel + 'Password');
  const User = mongoose.model(userModel);
  const { token, password } = req.body;

  const objectSchema = Joi.object({
    token: Joi.string().hex().length(64).required(),
    password: Joi.string().min(6).max(128).required(),
  });

  const { error } = objectSchema.validate({ token, password });
  if (error) {
    return res.status(409).json({
      success: false,
      result: null,
      error: error,
      message: 'The reset link or the new password is not valid.',
      errorMessage: error.message,
    });
  }

  // Consuming the token and loading the account in one atomic operation. The
  // filter includes the expiry, so this is also where expiry is enforced. A
  // second request arriving with the same token finds it already gone.
  //
  // Doing this BEFORE the password write is deliberate: a token that has been
  // spent stays spent even if the write below fails, whereas writing first
  // would leave a still-valid link behind on the error path.
  const user = await User.findOneAndUpdate(
    {
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpire: { $gt: new Date() },
      removed: false,
    },
    {
      $unset: {
        resetPasswordToken: '',
        resetPasswordExpire: '',
      },
    },
    {
      new: true,
    }
  ).exec();

  if (!user) return res.status(400).json(invalidLink);

  const databasePassword = await UserPassword.findOne({
    user: user._id,
    removed: false,
  });

  if (!databasePassword) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No password record exists for this account. Please contact your account administrator.',
    });
  }

  const salt = shortid.generate();
  const hashedPassword = bcrypt.hashSync(salt + password);

  // `loggedSessions: []` signs the account out everywhere. A password reset is
  // exactly the moment a stolen session must stop working, and the user is
  // about to sign in again with the password they just chose.
  //
  // The legacy `resetToken` on this document is cleared too. It powered the old
  // userId + shortid link shape and is no longer read anywhere, but leaving a
  // value in it would keep a dead credential in the database.
  await UserPassword.findOneAndUpdate(
    { user: user._id, removed: false },
    {
      password: hashedPassword,
      salt,
      emailVerified: true,
      resetToken: null,
      loggedSessions: [],
    },
    { new: true }
  ).exec();

  return res.status(200).json({
    success: true,
    result: null,
    message: 'Your password has been reset. You can now sign in with your new password.',
  });
};

module.exports = resetPassword;
