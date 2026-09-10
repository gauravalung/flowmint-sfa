import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/authRoutes";
import beatRoutes from "./modules/beats/beatRoutes";
import retailerRoutes from "./modules/retailers/retailerRoutes";
import visitRoutes from "./modules/visits/visitRoutes";
import productRoutes from "./modules/products/productRoutes";
import orderRoutes from "./modules/orders/orderRoutes";
import distributorRoutes from "./modules/distributors/distributorRoutes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1", beatRoutes); // owns /me/beat/today, /me/distributors/:id/beats, /beats/:id/retailers
  app.use("/api/v1/retailers", retailerRoutes);
  app.use("/api/v1/visits", visitRoutes);
  app.use("/api/v1/products", productRoutes);
  app.use("/api/v1/orders", orderRoutes);
  app.use("/api/v1/distributors", distributorRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
