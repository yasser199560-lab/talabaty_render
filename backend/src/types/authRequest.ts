import { Request } from "express";
import { Role } from "../models/User";

// A typed Request used by any route/controller that runs after
// authMiddleware.protect(). Using an explicit interface here (instead of
// globally augmenting Express's own Request type) avoids environment-
// specific issues where the ambient type-merge doesn't apply consistently
// across different ts-node / TypeScript / OS combinations.
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
  };
}
