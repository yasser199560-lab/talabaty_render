import { Request, Response, NextFunction } from "express";

// ========================================
// 404 Middleware
// ========================================

export const notFound = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404);

  next(new Error(`Route Not Found - ${req.originalUrl}`));
};

// ========================================
// Global Error Handler
// ========================================

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode =
    res.statusCode === 200
      ? 500
      : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Server Error",
    stack:
      process.env.NODE_ENV === "production"
        ? null
        : err.stack,
  });
};