import crypto from "crypto";
import { Request, Response } from "express";
import User from "../models/User";
import { generateToken } from "../utils/generateToken";
import { AuthRequest } from "../types/authRequest";
import { sendResetOtpEmail } from "../utils/sendEmail";

// Shared helpers for the forgot-password flow below — same hashing
// approach used for the JWT-adjacent secrets elsewhere in this file.
const hashValue = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");
const generateOtp = (): string => crypto.randomInt(100000, 1000000).toString();
const RESET_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESET_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESET_OTP_COOLDOWN_MS = 60 * 1000; // 1 minute between requests
const RESET_OTP_MAX_ATTEMPTS = 5;

// POST /api/auth/register
export const register = async (req: Request, res: Response) => {
  const { name, email, password, role, phone, town } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, and password are required" });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: "Please provide a valid email address" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ message: "Email already registered" });
  }

  // Only "customer" or "partner" can self-register through this public
  // endpoint. Admin accounts are never created here, regardless of what
  // the client sends — this is enforced server-side, not just hidden in the UI.
  const safeRole = role === "partner" ? "partner" : "customer";
  const status = safeRole === "partner" ? "pending" : "active";

  const user = await User.create({ name, email, password, role: safeRole, status, phone, town });

  res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    token: generateToken(user._id.toString(), user.role),
  });
};

// POST /api/auth/login
// body: { email, password, role } — "role" is which tab the person picked
// on the login screen (Customer / Partner / Admin). It's cosmetic on the
// frontend, but the backend uses it to reject a mismatch: correct password
// through the wrong tab is still rejected, so the Admin tab can't be used
// to probe whether an email belongs to an admin account.
export const login = async (req: Request, res: Response) => {
  const { email, password, role } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (role && user.role !== role) {
    return res.status(403).json({ message: "This account is not registered as that account type" });
  }

  if (user.status === "frozen") {
    return res.status(403).json({ message: "This account has been frozen by an administrator" });
  }

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    token: generateToken(user._id.toString(), user.role),
  });
};

// GET /api/auth/me — used by the Profile and Settings pages to load the
// logged-in user's own record (the JWT only carries id + role, not name/phone).
export const getMe = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone,
    town: user.town,
    avatarUrl: user.avatarUrl,
  });
};

// PATCH /api/auth/me — Profile page "Save changes". Shared by every role
// (customer Profile page, admin Profile page) — avatarUrl is accepted here
// too rather than a separate endpoint, since it's just another field on
// the same User document.
export const updateMe = async (req: AuthRequest, res: Response) => {
  const { name, phone, town, avatarUrl } = req.body;

  // A base64 data URL can legitimately be a few MB; anything drastically
  // larger than that is either a mistake or abuse, not a real profile photo.
  if (typeof avatarUrl === "string" && avatarUrl.length > 6_000_000) {
    return res.status(400).json({ message: "Image is too large" });
  }

  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (town !== undefined) user.town = town;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  await user.save();

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone,
    town: user.town,
    avatarUrl: user.avatarUrl,
  });
};

// PATCH /api/auth/change-password — Settings page "Change password"
export const changePassword = async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user!.id).select("+password");
  if (!user) return res.status(404).json({ message: "User not found" });

  const matches = await user.comparePassword(currentPassword);
  if (!matches) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: "Password updated" });
};

// POST /api/auth/forgot-password — step 1 of the "Forgot password?" flow.
// Always responds with the same generic message whether or not the email
// exists, so this endpoint can't be used to check which emails are
// registered. The verification code is only ever sent to the account's
// own inbox — it is never included in the HTTP response. (The previous
// version returned a ready-to-use reset link directly in the API response,
// which meant anyone who knew a victim's email could reset their password
// without ever touching that inbox. This closes that hole.)
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  const genericMessage = "If an account exists for that email, a verification code has been sent to it.";

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await User.findOne({ email }).select("+resetOtpLastSentAt");
  if (!user) {
    return res.json({ message: genericMessage });
  }

  // Cooldown so the same inbox can't be spammed with repeated codes.
  if (user.resetOtpLastSentAt && Date.now() - user.resetOtpLastSentAt.getTime() < RESET_OTP_COOLDOWN_MS) {
    return res.json({ message: genericMessage });
  }

  const otp = generateOtp();
  user.resetOtpHash = hashValue(otp);
  user.resetOtpExpire = new Date(Date.now() + RESET_OTP_TTL_MS);
  user.resetOtpAttempts = 0;
  user.resetOtpLastSentAt = new Date();
  // A fresh code invalidates any previously verified reset session.
  user.resetSessionTokenHash = undefined;
  user.resetSessionTokenExpire = undefined;
  await user.save();

  const emailed = await sendResetOtpEmail(email, otp);
  if (!emailed) {
    // No SMTP is configured for this environment yet — log the code
    // server-side only, so the flow stays testable locally without ever
    // exposing it through the API response itself.
    console.log(`[dev only] Password reset code for ${email}: ${otp}`);
  }

  res.json({ message: genericMessage });
};

// POST /api/auth/verify-reset-otp — step 2. Confirms the person making the
// request actually has access to the inbox the code was sent to, then
// issues a short-lived, single-use session token for the final reset step.
// Incorrect attempts are capped so the 6-digit code can't be brute-forced.
export const verifyResetOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const invalidMessage = "That code is invalid or has expired";

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and code are required" });
  }

  const user = await User.findOne({ email }).select(
    "+resetOtpHash +resetOtpExpire +resetOtpAttempts"
  );

  if (!user || !user.resetOtpHash || !user.resetOtpExpire) {
    return res.status(400).json({ message: invalidMessage });
  }

  if (user.resetOtpExpire.getTime() < Date.now()) {
    return res.status(400).json({ message: invalidMessage });
  }

  if ((user.resetOtpAttempts ?? 0) >= RESET_OTP_MAX_ATTEMPTS) {
    return res.status(429).json({ message: "Too many incorrect attempts. Please request a new code." });
  }

  if (user.resetOtpHash !== hashValue(String(otp))) {
    user.resetOtpAttempts = (user.resetOtpAttempts ?? 0) + 1;
    await user.save();
    return res.status(400).json({ message: invalidMessage });
  }

  // Correct and single-use: clear the code immediately so it can't be
  // replayed, then issue the short-lived session token that resetPassword
  // requires.
  const sessionToken = crypto.randomBytes(32).toString("hex");
  user.resetOtpHash = undefined;
  user.resetOtpExpire = undefined;
  user.resetOtpAttempts = 0;
  user.resetSessionTokenHash = hashValue(sessionToken);
  user.resetSessionTokenExpire = new Date(Date.now() + RESET_SESSION_TTL_MS);
  await user.save();

  res.json({ message: "Code verified", resetToken: sessionToken });
};

// POST /api/auth/reset-password — step 3. Requires the one-time session
// token issued by verifyResetOtp — the raw email/OTP pair is not accepted
// here, so this step is only reachable after proving control of the inbox.
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: "Reset session and new password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const hashedToken = hashValue(token);
  const user = await User.findOne({
    resetSessionTokenHash: hashedToken,
    resetSessionTokenExpire: { $gt: new Date() },
  }).select("+resetSessionTokenHash +resetSessionTokenExpire");

  if (!user) {
    return res.status(400).json({ message: "This reset session is invalid or has expired. Please start over." });
  }

  user.password = password;
  user.resetSessionTokenHash = undefined;
  user.resetSessionTokenExpire = undefined;
  await user.save();

  res.json({ message: "Password reset successfully. You can now log in." });
};

