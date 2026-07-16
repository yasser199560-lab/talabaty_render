import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export type Role = "customer" | "partner" | "admin";
export type AccountStatus = "pending" | "active" | "frozen";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: Role;
  status: AccountStatus;
  // Optional contact fields collected at signup (customer sign-up form).
  // Not part of the original BRD table but kept on User rather than a
  // new collection, same reasoning as admin: no other role-specific data.
  phone?: string;
  town?: string;
  // Data URL (base64) or hosted image URL for the account's profile
  // picture. Stored directly on User rather than a new collection since
  // it's a single small field shared by every role, same reasoning as
  // phone/town above.
  avatarUrl?: string;
  // Customer's preferred checkout payment method + a Whish account
  // reference, shown on the Payment Methods page and used to pre-select
  // the option at checkout.
  preferredPaymentMethod?: "COD" | "Whish Money";
  whishNumber?: string;
  // Forgot-password flow: we only ever store the SHA-256 hash of the
  // reset token, never the raw value, same principle as password storage.
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["customer", "partner", "admin"],
      default: "customer",
    },
    status: {
      type: String,
      enum: ["pending", "active", "frozen"],
      default: "active",
    },
    phone: { type: String },
    town: { type: String },
    avatarUrl: { type: String },
    preferredPaymentMethod: { type: String, enum: ["COD", "Whish Money"] },
    whishNumber: { type: String },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>("User", userSchema);
