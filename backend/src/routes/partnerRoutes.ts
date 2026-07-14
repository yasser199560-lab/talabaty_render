import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import {
  createMyProfile,
  getMyProfile,
  updateMyProfile,
  listPartners,
  getPartnerById,
} from "../controllers/partnerController";

const router = Router();

router.get("/", listPartners);
router.post("/me", protect, authorize("partner"), createMyProfile);
router.get("/me", protect, authorize("partner"), getMyProfile);
router.patch("/me", protect, authorize("partner"), updateMyProfile);
router.get("/:id", getPartnerById);

export default router;
