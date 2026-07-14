import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProduct extends Document {
  partnerId: Types.ObjectId;
  title: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  isActive: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "PartnerProfile", required: true },
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    category: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IProduct>("Product", productSchema);
