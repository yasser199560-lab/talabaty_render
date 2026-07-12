import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import orderRoutes from "./routes/orderRoutes";
import productRoutes from "./routes/productRoutes";
import partnerRoutes from "./routes/partnerRoutes";

import {
  notFound,
  errorHandler,
} from "./middleware/errorHandler";


const app = express();


// ===========================
// Middleware
// ===========================

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


app.use(express.json());

app.use(cookieParser());



// ===========================
// Health Check
// ===========================

app.get("/api/health", (req, res) => {

  res.status(200).json({
    status: "API is running",
  });

});



// ===========================
// API Routes
// ===========================

// Products API
app.use(
  "/api/products",
  productRoutes
);


// Orders API
// GET    /api/orders
// GET    /api/orders/:orderId
// PATCH  /api/orders/:orderId/status
app.use(
  "/api/orders",
  orderRoutes
);


// Partners API (keep if used elsewhere)
app.use(
  "/api/partners",
  partnerRoutes
);



// ===========================
// Error Handling
// ===========================

app.use(notFound);

app.use(errorHandler);



export default app;