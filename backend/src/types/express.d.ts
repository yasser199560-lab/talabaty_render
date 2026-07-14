import { Role } from "../models/User";

// Augments Express's Request type so req.user is available and typed
// after authMiddleware runs.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

export {};
