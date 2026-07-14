import mongoose, { Schema, Document, Types } from "mongoose";

export type PaymentMethodType = "Cash" | "Whish";

export interface IPaymentMethod extends Document {
  customerId: Types.ObjectId;
  type: PaymentMethodType;
  label: string;
  phoneNumber?: string; // Whish wallet is tied to a phone number
  isDefault: boolean;
  createdAt: Date;
}

const paymentMethodSchema = new Schema<IPaymentMethod>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["Cash", "Whish"], required: true },
    label: { type: String, required: true, trim: true },
    phoneNumber: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IPaymentMethod>("PaymentMethod", paymentMethodSchema);
