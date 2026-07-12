import jwt from "jsonwebtoken";
import { Role } from "../models/User";

export const generateToken = (id: string, role: Role): string => {
  const secret = process.env.JWT_SECRET as string;
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
  // The role is embedded directly in the token payload so every
  // downstream request can be authorized without a DB lookup.
  return jwt.sign({ id, role }, secret, { expiresIn });
};
