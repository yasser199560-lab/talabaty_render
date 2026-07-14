import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import {
  listProducts,
  listMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController";

const router = Router();

router.get("/", listProducts);
router.get("/mine", protect, authorize("partner"), listMyProducts);
router.post("/", protect, authorize("partner"), createProduct);
router.patch("/:id", protect, authorize("partner"), updateProduct);
router.delete("/:id", protect, authorize("partner"), deleteProduct);

export default router;
