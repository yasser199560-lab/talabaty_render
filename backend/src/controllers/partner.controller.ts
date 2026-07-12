import { Response } from "express";
import mongoose from "mongoose";
import PartnerProfile from "../models/PartnerProfile";
import { AuthRequest } from "../types/auth";

/**
 * GET /api/partners/me
 */
export const getMyPartnerProfile = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Not authenticated.",
      });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid user id on session.",
      });
    }

    const profile = await PartnerProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        message: "No partner profile found for this account.",
      });
    }

    return res.status(200).json({
      data: profile,
    });

  } catch (err) {
    console.error("getMyPartnerProfile error:", err);

    return res.status(500).json({
      message: "Failed to load partner profile.",
    });
  }
};