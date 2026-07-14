import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import partnerRoutes from "./routes/partnerRoutes";
import productRoutes from "./routes/productRoutes";
import cartRoutes from "./routes/cartRoutes";
import orderRoutes from "./routes/orderRoutes";
import adminRoutes from "./routes/adminRoutes";
import addressRoutes from "./routes/addressRoutes";
import paymentMethodRoutes from "./routes/paymentMethodRoutes";
import { notFound, errorHandler } from "./middleware/errorMiddleware";

const app = express();

// In development, Vite auto-increments the port (5173, 5174, 5175, ...) if
// the one before it is already taken, so locking CORS to a single origin
// from .env breaks the app the moment two dev servers are running at once.
// Any localhost/127.0.0.1 origin is allowed here; in production, only the
// exact CLIENT_URL is allowed.
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: isProduction
      ? allowedOrigin
      : (origin, callback) => {
          if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
