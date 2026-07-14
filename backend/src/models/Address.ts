import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAddress extends Document {
  customerId: Types.ObjectId;
  label: string;
  fullAddress: string;
  town?: string;
  isDefault: boolean;
  createdAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true },
    fullAddress: { type: String, required: true, trim: true },
    town: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IAddress>("Address", addressSchema);
