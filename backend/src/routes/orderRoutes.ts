import { Router } from "express";


import {
  getOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/orderController";


const router = Router();



// GET ALL ORDERS
// /api/orders
router.get(
  "/",
  getOrders
);



// GET ONE ORDER
// /api/orders/:orderId
router.get(
  "/:orderId",
  getOrderById
);



// UPDATE STATUS
// /api/orders/:orderId/status
router.patch(
  "/:orderId/status",
  updateOrderStatus
);



export default router;