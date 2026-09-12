import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "../models/User";
import { AuthRequest } from "../types/authRequest";

interface JwtPayload {
  id: string;
  role: Role;
}

// Same idea as authMiddleware.protect(), but never blocks the request.
// Used by routes that should work for guests AND give logged-in users a
// richer response (the assistant chat endpoint is the first example: a
// visitor can use it with no account, a logged-in customer gets order
// history woven in, a partner gets their store's data woven in).
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }

  const token = header.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET as string;
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = { id: decoded.id, role: decoded.role };
  } catch {
    // Invalid/expired token on an optional route — just treat as a guest
    // rather than rejecting the request.
  }

  next();
};
