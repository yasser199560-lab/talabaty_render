import { Request } from "express";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };

  cookies: {
    [key: string]: string;
  };
}