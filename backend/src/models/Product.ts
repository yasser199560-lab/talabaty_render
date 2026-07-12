import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  partnerId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;

  title: string;
  description: string;

  price: number;

  imageUrl: string;

  paymentStatus: "Pending" | "Paid" | "Unpaid";

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },

   categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: false
},

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Unpaid"],
      default: "Pending",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model<IProduct>("Product", productSchema);

export default Product;