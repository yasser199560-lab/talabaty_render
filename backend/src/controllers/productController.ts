import { Request, Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Product from "../models/Product";
import PartnerProfile from "../models/PartnerProfile";

// GET /api/products — public catalog browsing.
// ?category=Restaurant, ?partnerId=..., and ?search=... can be combined —
// the store detail page uses ?partnerId to load one store's menu instead
// of fetching every product and filtering client-side.
export const listProducts = async (req: Request, res: Response) => {
  const { category, partnerId, search } = req.query;
  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;
  if (partnerId) filter.partnerId = partnerId;
  if (search) filter.title = { $regex: search as string, $options: "i" };
  const products = await Product.find(filter).limit(100);
  res.json(products);
};

// POST /api/products — partner creates a product listing
export const createProduct = async (req: AuthRequest, res: Response) => {
  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  if (!profile) {
    return res.status(400).json({ message: "Complete your partner profile first" });
  }

  const { title, description, price, imageUrl, category } = req.body;

  if (!title || typeof title !== "string") {
    return res.status(400).json({ message: "title is required" });
  }
  if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
    return res.status(400).json({ message: "price must be a positive number" });
  }

  const product = await Product.create({
    partnerId: profile._id,
    title,
    description,
    price,
    imageUrl,
    category,
  });

  res.status(201).json(product);
};

// GET /api/products/mine — partner's own products (any status, not just active)
export const listMyProducts = async (req: AuthRequest, res: Response) => {
  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  if (!profile) return res.json([]);
  const products = await Product.find({ partnerId: profile._id }).sort({ createdAt: -1 });
  res.json(products);
};

// DELETE /api/products/:id — partner deletes their own product only
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  const product = await Product.findOneAndDelete({ _id: req.params.id, partnerId: profile?._id });
  if (!product) {
    return res.status(404).json({ message: "Product not found or not owned by you" });
  }
  res.json({ message: "Product deleted" });
};

// PATCH /api/products/:id — partner updates their own product only.
// Only these fields can be changed this way — partnerId/isActive/etc.
// are deliberately not writable through this endpoint.
const UPDATABLE_PRODUCT_FIELDS = ["title", "description", "price", "imageUrl", "category"] as const;

export const updateProduct = async (req: AuthRequest, res: Response) => {
  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  const product = await Product.findOne({ _id: req.params.id, partnerId: profile?._id });

  if (!product) {
    return res.status(404).json({ message: "Product not found or not owned by you" });
  }

  if (req.body.price !== undefined && (typeof req.body.price !== "number" || req.body.price < 0)) {
    return res.status(400).json({ message: "price must be a positive number" });
  }

  for (const field of UPDATABLE_PRODUCT_FIELDS) {
    if (req.body[field] !== undefined) {
      (product as any)[field] = req.body[field];
    }
  }

  await product.save();
  res.json(product);
};
