import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface User {
    id: string;
    role: string;
  }

  interface Request {
    user?: User;
  }
}

export {};