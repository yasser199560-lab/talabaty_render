import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Cart from "../models/Cart";
import Product from "../models/Product";

// GET /api/cart
export const getMyCart = async (req: AuthRequest, res: Response) => {
  let cart = await Cart.findOne({ customerId: req.user!.id }).populate("items.productId");
  if (!cart) {
    cart = await Cart.create({ customerId: req.user!.id, items: [] });
  }
  res.json(cart);
};

// POST /api/cart/items — add a product, or bump quantity if it's already in the cart
export const addItem = async (req: AuthRequest, res: Response) => {
  const { productId, quantity } = req.body;

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    return res.status(404).json({ message: "Product not found or no longer available" });
  }

  let cart = await Cart.findOne({ customerId: req.user!.id });
  if (!cart) {
    cart = await Cart.create({ customerId: req.user!.id, items: [] });
  }

  const existingItem = cart.items.find((i) => i.productId.toString() === productId);
  if (existingItem) {
    existingItem.quantity += quantity ?? 1;
  } else {
    cart.items.push({ productId, quantity: quantity ?? 1 });
  }

  await cart.save();
  await cart.populate("items.productId");
  res.json(cart);
};

// PATCH /api/cart/items/:productId — set an exact quantity (used by the +/- stepper).
// Setting quantity to 0 or less removes the line item entirely.
export const updateItemQuantity = async (req: AuthRequest, res: Response) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  const cart = await Cart.findOne({ customerId: req.user!.id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => i.productId.toString() !== productId);
  } else {
    const item = cart.items.find((i) => i.productId.toString() === productId);
    if (!item) return res.status(404).json({ message: "Item not in cart" });
    item.quantity = quantity;
  }

  await cart.save();
  await cart.populate("items.productId");
  res.json(cart);
};

// DELETE /api/cart/items/:productId
export const removeItem = async (req: AuthRequest, res: Response) => {
  const { productId } = req.params;

  const cart = await Cart.findOne({ customerId: req.user!.id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  cart.items = cart.items.filter((i) => i.productId.toString() !== productId);

  await cart.save();
  await cart.populate("items.productId");
  res.json(cart);
};
