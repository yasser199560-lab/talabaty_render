import { Request, Response } from "express";
import { AuthRequest } from "../types/authRequest";
import PartnerProfile from "../models/PartnerProfile";
import User from "../models/User";

// POST /api/partners/me — a partner completes their store profile after registering
export const createMyProfile = async (req: AuthRequest, res: Response) => {
  const { storeName, description, address, phoneNumber, category, deliveryTime } = req.body;

  const existing = await PartnerProfile.findOne({ userId: req.user!.id });
  if (existing) {
    return res.status(400).json({ message: "Partner profile already exists" });
  }

  const profile = await PartnerProfile.create({
    userId: req.user!.id,
    storeName,
    description,
    address,
    phoneNumber,
    category,
    deliveryTime,
  });

  res.status(201).json(profile);
};

// GET /api/partners/me
export const getMyProfile = async (req: AuthRequest, res: Response) => {
  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  if (!profile) return res.status(404).json({ message: "Partner profile not found" });
  res.json(profile);
};

// Only these fields can be changed through the "Store profile" page —
// userId/rating/etc. are deliberately not writable through this endpoint.
const UPDATABLE_PROFILE_FIELDS = [
  "storeName",
  "description",
  "address",
  "phoneNumber",
  "category",
  "deliveryTime",
  "coverImageUrl",
] as const;

// PATCH /api/partners/me — a partner edits their own store profile
// (name, description, address, phone, category, delivery estimate, cover
// image) from the Store profile page.
export const updateMyProfile = async (req: AuthRequest, res: Response) => {
  const profile = await PartnerProfile.findOne({ userId: req.user!.id });
  if (!profile) return res.status(404).json({ message: "Partner profile not found" });

  for (const field of UPDATABLE_PROFILE_FIELDS) {
    if (req.body[field] !== undefined) {
      (profile as any)[field] = req.body[field];
    }
  }

  await profile.save();
  res.json(profile);
};

// GET /api/partners — public storefront listing (only approved/active partners)
export const listPartners = async (req: Request, res: Response) => {
  const { category, search } = req.query;
  const activePartnerUserIds = await User.find({ role: "partner", status: "active" }).distinct("_id");
  const filter: Record<string, unknown> = { userId: { $in: activePartnerUserIds } };
  if (category) filter.category = category;
  if (search) filter.storeName = { $regex: search as string, $options: "i" };
  const partners = await PartnerProfile.find(filter);
  res.json(partners);
};

// GET /api/partners/:id — a single store's public profile, used by the
// store detail page instead of fetching every store and filtering client-side.
export const getPartnerById = async (req: Request, res: Response) => {
  const activePartnerUserIds = await User.find({ role: "partner", status: "active" }).distinct("_id");
  const partner = await PartnerProfile.findOne({ _id: req.params.id, userId: { $in: activePartnerUserIds } });
  if (!partner) return res.status(404).json({ message: "Store not found" });
  res.json(partner);
};
