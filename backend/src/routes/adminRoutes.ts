import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import {
  getDashboardStats,
  getDashboardOverview,
  listCustomers,
  listPartnersForAdmin,
  listOrdersForAdmin,
  freezeUser,
  unfreezeUser,
  deleteUser,
  approvePartner,
  monitorAllProducts,
  listUsersForAdmin,
} from "../controllers/adminController";

const router: Router = Router();

// Every route below requires a valid JWT AND role === "admin".
router.use(protect, authorize("admin"));

// Dashboard Statistics & Card Previews
router.get("/stats", getDashboardStats);
router.get("/overview", getDashboardOverview);

// Main Data Lists
router.get("/customers", listCustomers);
router.get("/partners", listPartnersForAdmin);
router.get("/orders", listOrdersForAdmin);
router.get("/users", listUsersForAdmin);
router.get("/products", monitorAllProducts);

// Customer Management Actions
router.patch("/customers/:userId/freeze", freezeUser);
router.patch("/customers/:userId/unfreeze", unfreezeUser);
router.delete("/customers/:userId", deleteUser);

// Partner Management Actions
router.patch("/partners/:userId/freeze", freezeUser);
router.patch("/partners/:userId/unfreeze", unfreezeUser);
router.delete("/partners/:userId", deleteUser);
router.patch("/partners/:userId/approve", approvePartner);

export default router;