/**
 * The password-reset email.
 *
 * Built as a single table-based HTML document rather than with a template
 * library so it renders in the mail clients this ERP's users actually use
 * (Outlook desktop included). The only dynamic values are the recipient's
 * name, the portal label and the link, and all three are escaped here.
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

exports.passwordReset = ({
  name = '',
  link = '',
  portalLabel = '3PL Dynamics',
  ttlMinutes = 10,
} = {}) => {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  const safePortal = escapeHtml(portalLabel);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset your password</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e9f2;">
            <tr>
              <td style="background:#1677ff;padding:22px 28px;">
                <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">3PL Dynamics</span>
                <div style="font-size:12px;color:#dbeafe;margin-top:2px;">${safePortal}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#111827;">Reset your password</h1>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.65;">Hello ${safeName},</p>
                <p style="margin:0 0 22px;font-size:14px;line-height:1.65;">
                  We received a request to reset the password for your 3PL Dynamics account.
                  Click the button below to choose a new password.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                  <tr>
                    <td style="border-radius:8px;background:#1677ff;">
                      <a href="${safeLink}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Reset password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 10px;font-size:13px;line-height:1.65;color:#4b5563;">
                  This link expires in ${Number(ttlMinutes) || 10} minutes and can be used once.
                </p>
                <p style="margin:0 0 18px;font-size:13px;line-height:1.65;color:#4b5563;">
                  If the button does not work, copy and paste this address into your browser:
                </p>
                <p style="margin:0 0 22px;font-size:12px;line-height:1.6;word-break:break-all;color:#1677ff;">
                  ${safeLink}
                </p>
                <p style="margin:0;font-size:13px;line-height:1.65;color:#4b5563;">
                  If you did not request this, you can safely ignore this email. Your password will not change.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e9f2;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:#6b7280;">
                  This is an automated message from 3PL Dynamics. Please do not reply to it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
