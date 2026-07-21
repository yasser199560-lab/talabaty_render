import nodemailer, { Transporter } from "nodemailer";

// Lazily builds a single reusable SMTP transporter from environment
// variables. If SMTP isn't configured (e.g. local development without a
// mail provider set up yet), this returns null so callers can fall back
// to logging the code server-side instead of throwing — the forgot-password
// flow must keep working even before SMTP is wired up, it just shouldn't
// ever hand the code back to the browser (that was the original bug).
let transporter: Transporter | null | undefined;

const getTransporter = (): Transporter | null => {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
};

// Sends the password-reset verification code by email. Returns true if a
// real email went out, false if SMTP isn't configured or the send itself
// failed — either way the caller falls back to logging the code to the
// server console, so a bad Gmail app password never turns into a 500 for
// the person requesting the reset.
export const sendResetOtpEmail = async (to: string, otp: string): Promise<boolean> => {
  const activeTransporter = getTransporter();
  if (!activeTransporter) return false;

  try {
    await activeTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "Your Talabaty verification code",
      text: `Your Talabaty verification code is ${otp}. It expires in 10 minutes. If you did not request this, you can safely ignore this email.`,
      html: buildOtpEmailHtml(otp),
    });
    return true;
  } catch (err) {
    // Logged server-side only — never surfaced to the caller of
    // forgot-password, which must keep returning its generic message
    // either way.
    console.error("Failed to send password reset email:", err);
    return false;
  }
};

// Simple branded HTML template, using inline styles and table-based layout
// (the safest subset of HTML/CSS across email clients like Gmail/Outlook,
// which strip <style> blocks and don't support modern CSS layout).
const buildOtpEmailHtml = (otp: string): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2fe;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;max-width:480px;">
        <tr>
          <td style="background-color:#0d1830;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">Talabaty</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#0d1830;font-size:16px;">Here's your password reset code:</p>
            <p style="margin:0 0 24px;text-align:center;">
              <span style="display:inline-block;padding:14px 28px;background-color:#eef2fe;border-radius:8px;font-size:32px;font-weight:800;letter-spacing:8px;color:#2748d6;">${otp}</span>
            </p>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;">
              Enter this code on the reset password screen to continue. It expires in <strong>10 minutes</strong>.
            </p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
              If you didn't request this, you can safely ignore this email — your password won't be changed.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">This is an automated message from Talabaty. Please don't reply to this email.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;
