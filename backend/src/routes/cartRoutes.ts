import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import { getMyCart, addItem, updateItemQuantity, removeItem } from "../controllers/cartController";

const router = Router();

router.get("/", protect, authorize("customer"), getMyCart);
router.post("/items", protect, authorize("customer"), addItem);
router.patch("/items/:productId", protect, authorize("customer"), updateItemQuantity);
router.delete("/items/:productId", protect, authorize("customer"), removeItem);

export default router;
