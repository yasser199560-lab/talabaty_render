import mongoose, { Schema, Document, Types } from "mongoose";

export type StoreCategory = "Restaurant" | "Supermarket" | "Pharmacy" | "Fashion" | "Bakery";

export interface IPartnerProfile extends Document {
  userId: Types.ObjectId;
  storeName: string;
  description?: string;
  address: string;
  phoneNumber: string;
  // Added to support the customer dashboard/store browsing UI
  // (category filters, popular-stores cards, rating, delivery estimate).
  // Not in the original BRD table, kept here since it's store-level data,
  // same reasoning as why partner_profiles exists separately from users.
  category?: StoreCategory;
  rating?: number;
  deliveryTime?: string;
  coverImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const partnerProfileSchema = new Schema<IPartnerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    storeName: { type: String, required: true },
    description: { type: String },
    address: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    category: {
      type: String,
      enum: ["Restaurant", "Supermarket", "Pharmacy", "Fashion", "Bakery"],
      default: "Restaurant",
    },
    rating: { type: Number, min: 0, max: 5, default: 4.5 },
    deliveryTime: { type: String, default: "25-35 min" },
    coverImageUrl: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IPartnerProfile>("PartnerProfile", partnerProfileSchema);
