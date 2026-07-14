import { Request, Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Cart from "../models/Cart";
import Order from "../models/Order";
import Product from "../models/Product";
import PartnerProfile from "../models/PartnerProfile";
import Address from "../models/Address";

// POST /api/orders — checkout: snapshot cart items into an order.
// A cart can hold items from several different stores at once (the
// customer can browse and add from any store), so checkout splits it
// into one Order per store rather than assuming a single partnerId —
// otherwise items from every store but the last one added would silently
// vanish from that store's own order list.
export const createOrder = async (req: AuthRequest, res: Response) => {
  const { paymentMethod, addressId } = req.body;

  if (!["COD", "Whish Money"].includes(paymentMethod)) {
    return res.status(400).json({ message: "paymentMethod must be COD or Whish Money" });
  }

  const cart = await Cart.findOne({ customerId: req.user!.id }).populate("items.productId");
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  let deliveryAddress: string | undefined;
  if (addressId) {
    const address = await Address.findOne({ _id: addressId, customerId: req.user!.id });
    if (address) {
      deliveryAddress = address.town ? `${address.fullAddress}, ${address.town}` : address.fullAddress;
    }
  }

  // Group cart line items by which store (partnerId) they belong to.
  const itemsByPartner = new Map<string, { productId: any; title: string; price: number; quantity: number; imageUrl?: string }[]>();

  for (const item of cart.items) {
    const product = item.productId as any;
    if (!product) continue; // product was deleted after being added to the cart

    const partnerKey = product.partnerId.toString();
    const bucket = itemsByPartner.get(partnerKey) ?? [];
    bucket.push({
      productId: product._id,
      title: product.title,
      price: product.price,
      quantity: item.quantity,
      imageUrl: product.imageUrl,
    });
    itemsByPartner.set(partnerKey, bucket);
  }

  if (itemsByPartner.size === 0) {
    return res.status(400).json({ message: "Cart items are no longer available" });
  }

  const orders = await Promise.all(
    Array.from(itemsByPartner.entries()).map(([partnerId, items]) => {
      const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      return Order.create({
        customerId: req.user!.id,
        partnerId,
        items,
        totalAmount,
        paymentMethod,
        deliveryAddress,
      });
    })
  );

  cart.items = [];
  await cart.save();

  // Kept the response shape backward compatible: `orders` for the full
  // split, plus the first order at the top level so any client only
  // expecting a single order (e.g. redirecting to its confirmation page)
  // still works without changes.
  res.status(201).json({ ...orders[0].toObject(), orders });
};

// GET /api/orders/mine — customer's own order history
export const getMyOrders = async (req: AuthRequest, res: Response) => {
  const orders = await Order.find({ customerId: req.user!.id }).sort({ createdAt: -1 });
  res.json(orders);
};

// GET /api/orders/:id — a single order, used by the order confirmation
// page. Scoped to the logged-in customer so one customer can't view
// another customer's order by guessing an id.
export const getOrderById = async (req: AuthRequest, res: Response) => {
  const order = await Order.findOne({ _id: req.params.id, customerId: req.user!.id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
};

// GET /api/orders/partner-mine — orders placed with the logged-in partner's store
export const getPartnerOrders = async (req: AuthRequest, res: Response) => {
  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  if (!profile) return res.json([]);
  // Populate the customer's name so the partner order list can show who
  // placed the order instead of just a raw customerId.
  const orders = await Order.find({ partnerId: profile._id })
    .sort({ createdAt: -1 })
    .populate("customerId", "name");
  res.json(orders);
};

// Order lifecycle a partner is allowed to move an order through, in order.
// "out_for_delivery" is shown to the customer as "with the delivery
// company / on the way" and "completed" is shown as "Delivered".
const PARTNER_SETTABLE_STATUSES = ["accepted", "out_for_delivery", "completed", "cancelled"] as const;

// PATCH /api/orders/:id/status — a partner updates the status of an order
// placed with their own store (accept it, hand it to the delivery company,
// mark it delivered, or cancel it). Scoped to the logged-in partner's own
// PartnerProfile so one store can never touch another store's orders.
export const updatePartnerOrderStatus = async (req: AuthRequest, res: Response) => {
  const { status } = req.body;

  if (!PARTNER_SETTABLE_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `status must be one of: ${PARTNER_SETTABLE_STATUSES.join(", ")}`,
    });
  }

  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  if (!profile) return res.status(404).json({ message: "Partner profile not found" });

  const order = await Order.findOne({ _id: req.params.id, partnerId: profile._id });
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.orderStatus = status;
  await order.save();

  res.json(order);
};

// DELETE /api/orders/:id — a partner removes an order from their own list
// (e.g. a duplicate, a test order, or one they no longer want to track).
// This only ever deletes an order that belongs to the logged-in partner's
// own store — it can never reach into another store's orders.
export const deletePartnerOrder = async (req: AuthRequest, res: Response) => {
  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  if (!profile) return res.status(404).json({ message: "Partner profile not found" });

  const order = await Order.findOneAndDelete({ _id: req.params.id, partnerId: profile._id });
  if (!order) return res.status(404).json({ message: "Order not found or not owned by your store" });

  res.json({ message: "Order deleted" });
};
