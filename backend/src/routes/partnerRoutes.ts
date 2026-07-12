import { Router } from "express";
import { getMyPartnerProfile } from "../controllers/partner.controller";
// Swap this for your actual auth middleware — the one that reads the
// httpOnly JWT cookie and attaches req.user. Likely already exists
// somewhere in your project (e.g. authMiddleware.ts / protect.ts).
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/me", protect, getMyPartnerProfile);

export default router;