import mongoose, { Schema, Document } from "mongoose";


export type CategoryStatus =
  | "pending"
  | "approved"
  | "rejected";


export interface ICategory extends Document {

  name: string;

  description: string;

  status: CategoryStatus;

  requestedBy?: mongoose.Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}



const categorySchema = new Schema<ICategory>(
  {

    name: {
      type: String,
      required: true,
      trim: true
    },


    description: {
      type: String,
      required: true,
      trim: true
    },


    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected"
      ],
      default: "pending"
    },


    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "Partner"
    }

  },
  {
    timestamps: true
  }
);



export default mongoose.model<ICategory>(
  "Category",
  categorySchema
);