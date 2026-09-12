import { Router } from "express";
import { optionalAuth } from "../middleware/optionalAuth";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import { rateLimit } from "../middleware/rateLimiter";
import { chatWithAssistant, generateProductCopy } from "../controllers/assistantController";

const router: Router = Router();

// Open to guests (optionalAuth), but rate limited per IP since every call
// costs real money against the Anthropic API. 20/min is generous for a
// real user typing messages, tight enough to blunt casual abuse.
router.post("/chat", rateLimit(60_000, 20), optionalAuth, chatWithAssistant);

// Partner-only, tighter limit since it's used occasionally per item, not
// per conversation turn.
router.post("/generate-description", rateLimit(60_000, 10), protect, authorize("partner"), generateProductCopy);

export default router;
