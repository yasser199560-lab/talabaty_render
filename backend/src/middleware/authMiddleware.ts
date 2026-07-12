import { Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AuthRequest } from "../types/auth";

const COOKIE_NAME = "token";
const JWT_SECRET = process.env.JWT_SECRET as string;

export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        message: "Not authenticated.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    req.user = {
      id: decoded.id as string,
      role: decoded.role as string,
    };

    next();

  } catch (err) {
    console.error("Auth middleware error:", err);

    return res.status(401).json({
      message: "Invalid or expired session.",
    });
  }
};


export const requireRole =
  (...allowedRoles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {

    if (!req.user) {
      return res.status(401).json({
        message: "Not authenticated.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Not authorized for this action.",
      });
    }

    next();
  };