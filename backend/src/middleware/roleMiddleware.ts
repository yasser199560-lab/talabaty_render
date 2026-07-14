import { Response, NextFunction } from "express";
import { Role } from "../models/User";
import { AuthRequest } from "../types/authRequest";

// Usage: router.delete("/users/:id", protect, authorize("admin"), deleteUser)
// Must run AFTER protect(), since it relies on req.user being set.
export const authorize = (...allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied: requires role ${allowedRoles.join(" or ")}`,
      });
    }
    next();
  };
};
