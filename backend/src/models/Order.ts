import { Schema, model, Document, Types } from "mongoose";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "COD" | "Card" | "Online";

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

  deliveryAddress: string;

  orderStatus: OrderStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    imageUrl: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);


const OrderSchema = new Schema<IOrder>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "PartnerProfile",
      required: true,
      index: true,
    },

    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (v: IOrderItem[]) =>
          Array.isArray(v) && v.length > 0,

        message: "Order must contain at least one item.",
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "Card", "Online"],
      default: "COD",
    },

    deliveryAddress: {
      type: String,
      required: true,
      trim: true,
    },

    orderStatus: {
      type: String,
      enum: [
        "pending",
        "preparing",
        "delivered",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
  },

  {
    timestamps: true,
    collection: "orders",
  }
);


OrderSchema.index({
  partnerId: 1,
  orderStatus: 1,
  createdAt: -1,
});


export default model<IOrder>("Order", OrderSchema);