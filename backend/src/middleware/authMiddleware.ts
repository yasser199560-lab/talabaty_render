import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "../models/User";
import { AuthRequest } from "../types/authRequest";

interface JwtPayload {
  id: string;
  role: Role;
}

// Verifies the JWT sent in the Authorization header and attaches
// { id, role } to req.user. Every protected route runs this first.
export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated, no token provided" });
  }

  const token = header.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET as string;
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
