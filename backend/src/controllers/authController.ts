import crypto from "crypto";
import { Request, Response } from "express";
import User from "../models/User";
import { generateToken } from "../utils/generateToken";
import { AuthRequest } from "../types/authRequest";

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

// POST /api/auth/forgot-password — Login page "Forgot password?" flow.
// Always responds with the same generic message whether or not the email
// exists, so this endpoint can't be used to check which emails are
// registered. In development (no email service configured) the reset
// link is also returned directly in the response so the flow is testable
// end-to-end without wiring up a real mail provider.
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  const genericMessage = "If an account exists for that email, a reset link will be sent shortly.";

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ message: genericMessage });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

  // No email transport is configured in this project, so the link is
  // logged server-side and echoed back in dev so the flow can be tested.
  console.log(`Password reset requested for ${email}: ${resetUrl}`);

  res.json({
    message: genericMessage,
    ...(process.env.NODE_ENV !== "production" ? { resetUrl } : {}),
  });
};

// POST /api/auth/reset-password — sets a new password from a valid,
// unexpired reset token issued by forgotPassword.
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: "Token and new password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpire");

  if (!user) {
    return res.status(400).json({ message: "This reset link is invalid or has expired" });
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({ message: "Password reset successfully. You can now log in." });
};

