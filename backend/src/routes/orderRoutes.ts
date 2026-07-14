import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getPartnerOrders,
  updatePartnerOrderStatus,
  deletePartnerOrder,
} from "../controllers/orderController";

const router = Router();

router.post("/", protect, authorize("customer"), createOrder);
router.get("/mine", protect, authorize("customer"), getMyOrders);
router.get("/partner-mine", protect, authorize("partner"), getPartnerOrders);
router.patch("/:id/status", protect, authorize("partner"), updatePartnerOrderStatus);
router.delete("/:id", protect, authorize("partner"), deletePartnerOrder);
router.get("/:id", protect, authorize("customer"), getOrderById);

export default router;
