import { Schema, model, Document, Types } from "mongoose";

export interface IPartnerProfile extends Document {
  userId: Types.ObjectId; // FK -> users._id (the login account for this store)
  storeName: string;
  description?: string;
  address?: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerProfileSchema = new Schema<IPartnerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one profile per login account
      index: true,
    },
    storeName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    address: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: "partnerprofiles", // matches the collection name shown in Compass
  }
);

export default model<IPartnerProfile>("PartnerProfile", PartnerProfileSchema);