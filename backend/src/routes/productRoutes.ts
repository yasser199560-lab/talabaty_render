import express from "express";

import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/productController";

import { validateProduct } from "../middleware/validateProduct";


const router = express.Router();


// ===============================
// PRODUCT ROUTES
// ===============================


// Create Product
router.post(
  "/",
  validateProduct,
  createProduct
);


// Get All Products
router.get(
  "/",
  getProducts
);


// Get Single Product
router.get(
  "/:id",
  getProductById
);


// Update Product
router.put(
  "/:id",
  updateProduct
);


// Delete Product
router.delete(
  "/:id",
  deleteProduct
);



export default router;