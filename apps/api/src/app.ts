import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/authRoutes";
import beatRoutes from "./modules/beats/beatRoutes";
import retailerRoutes from "./modules/retailers/retailerRoutes";
import visitRoutes from "./modules/visits/visitRoutes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/me", beatRoutes);
  app.use("/api/v1/retailers", retailerRoutes);
  app.use("/api/v1/visits", visitRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
