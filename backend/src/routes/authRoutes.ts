import { Router } from "express";
import {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";
import { rateLimit } from "../middleware/rateLimiter";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.patch("/change-password", protect, changePassword);

// Forgot-password flow: request a code, verify it, then reset the password
// using the short-lived session token verifyResetOtp returns. Both the
// code request and the code check are rate limited — these are the two
// endpoints most likely to be targeted by scripted abuse.
router.post("/forgot-password", rateLimit(60 * 1000, 3), forgotPassword);
router.post("/verify-reset-otp", rateLimit(60 * 1000, 8), verifyResetOtp);
router.post("/reset-password", resetPassword);

export default router;
