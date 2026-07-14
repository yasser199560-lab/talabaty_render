import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import {
  getMyPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from "../controllers/paymentMethodController";

const router = Router();

router.get("/", protect, authorize("customer"), getMyPaymentMethods);
router.post("/", protect, authorize("customer"), addPaymentMethod);
router.patch("/:id/default", protect, authorize("customer"), setDefaultPaymentMethod);
router.delete("/:id", protect, authorize("customer"), deletePaymentMethod);

export default router;
