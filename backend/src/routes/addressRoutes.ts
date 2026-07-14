import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import {
  getMyAddresses,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "../controllers/addressController";

const router = Router();

router.get("/", protect, authorize("customer"), getMyAddresses);
router.post("/", protect, authorize("customer"), addAddress);
router.patch("/:id", protect, authorize("customer"), updateAddress);
router.patch("/:id/default", protect, authorize("customer"), setDefaultAddress);
router.delete("/:id", protect, authorize("customer"), deleteAddress);

export default router;
