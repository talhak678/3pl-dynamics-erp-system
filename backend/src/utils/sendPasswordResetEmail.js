const nodemailer = require('nodemailer');

const { passwordReset } = require('../emailTemplate/passwordReset');

/**
 * SMTP transport for transactional password-reset mail.
 *
 * Kept separate from createAuthMiddleware/sendMail.js, which still uses Resend
 * for the sign-up flow. This flow was specified to use nodemailer and SMTP, so
 * it carries its own configuration and does not change how registration mail is
 * delivered.
 *
 * Every setting is read at call time rather than at module load. On Vercel the
 * module can be evaluated before the environment is fully available, and a
 * transporter captured at import time would keep whatever it saw then.
 */
const createTransport = () => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send password-reset emails.'
    );
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    typeof process.env.SMTP_SECURE === 'string' && process.env.SMTP_SECURE.length > 0
      ? process.env.SMTP_SECURE.toLowerCase() === 'true'
      : port === 465;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const fromAddress = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

/**
 * Whether the SMTP credentials this module needs are present at all.
 *
 * Exported so the controller can fail every request, rather than only the ones
 * for real accounts, when the deployment is missing its mail configuration. A
 * difference between those two responses would be an account-enumeration
 * oracle.
 */
const isConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const sendPasswordResetEmail = async ({
  to,
  name,
  link,
  portalLabel,
  ttlMinutes,
}) => {
  const transporter = createTransport();

  const html = passwordReset({ name, link, portalLabel, ttlMinutes });
  const text = [
    `Hello ${name || ''},`,
    '',
    'We received a request to reset the password for your 3PL Dynamics account.',
    `Open this link to choose a new password (it expires in ${ttlMinutes} minutes):`,
    link,
    '',
    'If you did not request this, you can safely ignore this email. Your password will not change.',
  ].join('\n');

  return transporter.sendMail({
    from: fromAddress(),
    to,
    subject: 'Reset your 3PL Dynamics password',
    text,
    html,
  });
};

module.exports = sendPasswordResetEmail;
module.exports.isConfigured = isConfigured;
