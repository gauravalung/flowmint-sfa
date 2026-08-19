import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/authRoutes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/v1/auth", authRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
