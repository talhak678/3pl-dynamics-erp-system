const crypto = require('crypto');

const Joi = require('joi');
const mongoose = require('mongoose');

const sendPasswordResetEmail = require('../../../utils/sendPasswordResetEmail');

/**
 * How long a reset link stays valid.
 *
 * Read from the environment on every request so a deployment can change it
 * without a code edit. The default matches the WMS product this flow was
 * modelled on, whose one-time code also expired after ten minutes.
 */
const resetTokenTtlMinutes = () => {
  const configured = Number(process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES);
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : 10;
};

/**
 * The database only ever sees this. The raw token goes into the email link, so
 * a stolen database dump yields hashes that cannot be turned back into links.
 */
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * The portal the request came from decides where the link points.
 *
 * The caller names the portal rather than the server trusting an arbitrary
 * Origin header, and the two destinations come from fixed environment values -
 * so an attacker cannot turn this endpoint into an open redirect by inventing a
 * base URL in the request body.
 */
const resolvePortalBaseUrl = (portal) => {
  const key = portal === 'superadmin' ? 'SUPERADMIN_URL' : 'FRONTEND_URL';
  const configured = String(process.env[key] || '').trim();

  if (!/^https?:\/\//i.test(configured)) {
    throw new Error(`${key} must be an absolute http(s) URL to build password-reset links.`);
  }

  return configured.replace(/\/+$/, '');
};

const portalLabel = (portal) =>
  portal === 'superadmin' ? 'Super Admin Portal' : 'Customer Portal';

const forgetPassword = async (req, res, { userModel }) => {
  const User = mongoose.model(userModel);
  const { email, portal } = req.body;

  const objectSchema = Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .required(),
    portal: Joi.string().valid('frontend', 'superadmin').default('frontend'),
  });

  const { error, value } = objectSchema.validate({ email, portal });
  if (error) {
    return res.status(409).json({
      success: false,
      result: null,
      error: error,
      message: 'Invalid email.',
      errorMessage: error.message,
    });
  }

  // Resolved before the account lookup on purpose. A missing base URL is a
  // deployment fault, not a user's problem, and it must surface as one loudly
  // enough that it gets fixed.
  let baseUrl;
  try {
    baseUrl = resolvePortalBaseUrl(value.portal);
  } catch (configError) {
    console.error('Password reset is misconfigured:', configError.message);
    return res.status(500).json({
      success: false,
      result: null,
      message: 'Password reset is temporarily unavailable. Please try again later.',
    });
  }

  // A missing mail configuration is a deployment fault. Checked before the
  // account lookup so that EVERY request fails the same way while it is
  // missing, rather than only requests for addresses that exist.
  if (!sendPasswordResetEmail.isConfigured()) {
    console.error(
      'Password reset email is unavailable: SMTP_HOST, SMTP_USER and SMTP_PASS are not all set.'
    );
    return res.status(500).json({
      success: false,
      result: null,
      message: 'Password reset is temporarily unavailable. Please try again later.',
    });
  }

  const normalizedEmail = value.email.trim().toLowerCase();

  // The Super Admin portal resets Super Admin accounts only. Without this, a
  // tenant could enter their address there, receive a link that returns to the
  // control-plane portal, change their password and then be refused at sign-in
  // because they are not a super admin. The generic response keeps the refusal
  // from revealing whether the address exists.
  const accountFilter = { email: normalizedEmail, removed: false };
  if (value.portal === 'superadmin') accountFilter.isSuperAdmin = true;

  const user = await User.findOne(accountFilter).select('+resetPasswordExpire');

  // The same response is returned whether or not the account exists. This
  // endpoint is public, so a different answer would let anyone test an address
  // and learn which ones have accounts here. The wording still tells a real
  // user what to do next.
  const genericResponse = {
    success: true,
    result: null,
    message: 'If an account exists for that email, a password reset link has been sent.',
  };

  if (!user) return res.status(200).json(genericResponse);

  const ttlMinutes = resetTokenTtlMinutes();
  const ttlMs = ttlMinutes * 60 * 1000;

  // One email a minute per account. This endpoint is public and sends mail on
  // demand, so without a floor anyone could use it to flood an inbox or burn
  // the SMTP quota. A genuinely new request is still answered exactly like the
  // first - the generic response does not reveal that this one was skipped.
  //
  // Derived from the expiry rather than a second stored timestamp: the token
  // was issued at `expire - ttl`, so "issued less than a minute ago" is the
  // same test shifted to today's clock.
  const cooldownMs = Math.min(60 * 1000, ttlMs);
  const issuedRecently =
    user.resetPasswordExpire instanceof Date &&
    user.resetPasswordExpire.getTime() - Date.now() > ttlMs - cooldownMs;

  if (issuedRecently) return res.status(200).json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashResetToken(rawToken);
  const resetPasswordExpire = new Date(Date.now() + ttlMs);

  // Replacing whatever token was there makes the newest request the only live
  // one, so two "forgot password" clicks cannot leave two working links.
  await User.findOneAndUpdate(
    { _id: user._id, removed: false },
    { resetPasswordToken: hashedToken, resetPasswordExpire },
    { new: true }
  ).exec();

  const link = `${baseUrl}/resetpassword/${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name || user.email,
      link,
      portalLabel: portalLabel(value.portal),
      ttlMinutes,
    });
  } catch (mailError) {
    // Do not leave a live token behind for an email that never went out. The
    // user can request a fresh one.
    await User.findOneAndUpdate(
      { _id: user._id, removed: false },
      { resetPasswordToken: null, resetPasswordExpire: null }
    ).exec();

    console.error('Password reset email failed:', mailError.message);

    // The same reply an unknown address gets. Reporting the failure only for
    // accounts that exist would let an SMTP outage be used to enumerate them;
    // the log line above is where an operator sees the real problem.
    return res.status(200).json(genericResponse);
  }

  return res.status(200).json(genericResponse);
};

module.exports = forgetPassword;
