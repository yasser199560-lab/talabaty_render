import { Request, Response, NextFunction } from "express";

// Minimal in-memory fixed-window rate limiter for sensitive auth endpoints
// (forgot-password, OTP verification). This runs per server instance —
// fine for a single-instance deployment like this project's; swap for a
// Redis-backed limiter if the app ever scales to multiple instances behind
// a load balancer.
const hits = new Map<string, number[]>();

export const rateLimit = (windowMs: number, max: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const recentHits = (hits.get(key) || []).filter((timestamp) => now - timestamp < windowMs);

    if (recentHits.length >= max) {
      return res.status(429).json({ message: "Too many attempts. Please try again in a minute." });
    }

    recentHits.push(now);
    hits.set(key, recentHits);
    next();
  };
};
