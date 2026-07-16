import { Request, Response } from "express";
import User from "../models/User"; 
import Order from "../models/Order";
import PartnerProfile from "../models/PartnerProfile";
import Product from "../models/Product";
import { parseStatusFilter, parseDateFilter } from "../utils/orderQueryFilters";

// ========================================================
// 1. GET /api/admin/stats
// ========================================================
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [totalCustomers, activePartners, totalOrders, frozenAccounts] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "partner", status: "active" }),
      Order.countDocuments({}),
      User.countDocuments({ status: "frozen" })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        activePartners,
        totalOrders,
        frozenAccounts
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to compile metrics", error: error.message });
  }
};

// ========================================================
// 2. GET /api/admin/overview
// ========================================================
export const getDashboardOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const recentCustomers = await User.find({ role: "customer" })
      .sort({ createdAt: -1 })
      .limit(5);

    const recentProfiles = await PartnerProfile.find()
      .populate("userId")
      .sort({ createdAt: -1 })
      .limit(5);

    const partners = recentProfiles.map((profile: any) => ({
      ...profile.toObject(),
      status: profile.userId?.status || "unknown"
    }));

    res.status(200).json({
      success: true,
      data: {
        customers: recentCustomers,
        partners: partners
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to compile overview", error: error.message });
  }
};

// ========================================================
// 3. GET /api/admin/customers
// ========================================================
export const listCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const customers = await User.find({ role: "customer" }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to fetch customers", error: error.message });
  }
};

// ========================================================
// 4. GET /api/admin/partners
// ========================================================
export const listPartnersForAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const profiles = await PartnerProfile.find().populate("userId").sort({ createdAt: -1 });
    
    const partners = profiles.map((profile: any) => ({
      ...profile.toObject(),
      status: profile.userId?.status || "unknown"
    }));

    res.status(200).json({ success: true, data: partners });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to fetch partners", error: error.message });
  }
};

// ========================================================
// 5. GET /api/admin/orders
// Supports ?status=<orderStatus|all> and
// ?dateFilter=today|last7|last30|month|custom (+ startDate/endDate for
// custom) as backend query filters, plus the full item breakdown and the
// customer's email so the admin order list and its detail modal don't need
// a second request.
// ========================================================
export const listOrdersForAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};

    const status = parseStatusFilter(req.query.status);
    if (status) filter.orderStatus = status;

    const dateRange = parseDateFilter(req.query.dateFilter, req.query.startDate, req.query.endDate);
    if (dateRange) filter.createdAt = dateRange;

    const ordersFromDb = await Order.find(filter)
      .populate("customerId", "name email")
      .populate("partnerId", "storeName")
      .sort({ createdAt: -1 });

    const orders = ordersFromDb.map((order: any) => ({
      _id: order._id,
      customerId: order.customerId?._id || order.customerId,
      partnerId: order.partnerId?._id || order.partnerId,
      customerEmail: order.customerId?.email || "Unknown",
      partnerName: order.partnerId?.storeName || "Unknown Store",
      items: order.items,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      deliveryAddress: order.deliveryAddress,
      createdAt: order.createdAt
    }));

    res.status(200).json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to fetch orders", error: error.message });
  }
};

// ========================================================
// 6. PATCH /api/admin/users/:userId/freeze
// ========================================================
export const freezeUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const profile = await PartnerProfile.findById(userId);

    if (profile) {
      const updatedUser = await User.findByIdAndUpdate(profile.userId, { status: "frozen" }, { new: true });
      res.status(200).json({ success: true, data: { ...profile.toObject(), status: updatedUser?.status } });
      return;
    }

    const updatedCustomer = await User.findByIdAndUpdate(userId, { status: "frozen" }, { new: true });
    if (!updatedCustomer) {
      res.status(404).json({ success: false, message: "Target account records not found" });
      return;
    }
    res.status(200).json({ success: true, data: updatedCustomer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to freeze account status", error: error.message });
  }
};

// ========================================================
// 7. PATCH /api/admin/users/:userId/unfreeze
// ========================================================
export const unfreezeUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const profile = await PartnerProfile.findById(userId);

    if (profile) {
      const updatedUser = await User.findByIdAndUpdate(profile.userId, { status: "active" }, { new: true });
      res.status(200).json({ success: true, data: { ...profile.toObject(), status: updatedUser?.status } });
      return;
    }

    const updatedCustomer = await User.findByIdAndUpdate(userId, { status: "active" }, { new: true });
    if (!updatedCustomer) {
      res.status(404).json({ success: false, message: "Target account records not found" });
      return;
    }
    res.status(200).json({ success: true, data: updatedCustomer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to unfreeze user account", error: error.message });
  }
};

// ========================================================
// 8. DELETE /api/admin/users/:userId
// ========================================================
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    let targetUserId = userId;

    const profile = await PartnerProfile.findById(userId);
    if (profile) {
      targetUserId = profile.userId.toString();
      await PartnerProfile.findByIdAndDelete(userId);
    }

    const deletedUser = await User.findByIdAndDelete(targetUserId);
    if (!deletedUser && !profile) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (deletedUser && deletedUser.role === "partner") {
      await PartnerProfile.findOneAndDelete({ userId: targetUserId });
    }

    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to delete user", error: error.message });
  }
};

// ========================================================
// 9. PATCH /api/admin/partners/:userId/approve
// ========================================================
export const approvePartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Accept either the PartnerProfile's own _id (what the admin UI sends,
    // same convention as freeze/unfreeze) or a raw User _id, same pattern
    // used above so this endpoint doesn't depend on the frontend knowing
    // which id shape is populated on the object it has in hand.
    const profile = await PartnerProfile.findById(userId);
    const targetUserId = profile ? profile.userId : userId;

    const updatedUser = await User.findByIdAndUpdate(targetUserId, { status: "active" }, { new: true });

    if (!updatedUser) {
      res.status(404).json({ success: false, message: "Partner user not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Partner application approved successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to approve partner profile", error: error.message });
  }
};

// ========================================================
// 10. GET /api/admin/products
// ========================================================
export const monitorAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find().populate("partnerId").sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to monitor products", error: error.message });
  }
};

// ========================================================
// 11. GET /api/admin/users
// ========================================================
export const listUsersForAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to compile user lists" });
  }
};