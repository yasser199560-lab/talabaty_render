import mongoose, { Schema, Document, Types } from "mongoose";

export type PaymentMethod = "COD" | "Whish Money";
export type OrderStatus = "pending" | "accepted" | "out_for_delivery" | "completed" | "cancelled";

export interface IOrderItem {
  productId: Types.ObjectId;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface IOrder extends Document {
  customerId: Types.ObjectId;
  partnerId: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  orderStatus: OrderStatus;
  deliveryAddress?: string;
  createdAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    title: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    partnerId: { type: Schema.Types.ObjectId, ref: "PartnerProfile", required: true },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["COD", "Whish Money"], required: true },
    deliveryAddress: { type: String },
    orderStatus: {
      type: String,
      enum: ["pending", "accepted", "out_for_delivery", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IOrder>("Order", orderSchema);
