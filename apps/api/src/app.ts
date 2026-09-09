import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/authRoutes";
import beatRoutes from "./modules/beats/beatRoutes";
import adminBeatRoutes from "./modules/beats/adminBeatRoutes";
import retailerRoutes from "./modules/retailers/retailerRoutes";
import adminRetailerRoutes from "./modules/retailers/adminRetailerRoutes";
import retailerSubcategoryRoutes from "./modules/retailerSubcategories/retailerSubcategoryRoutes";
import visitRoutes from "./modules/visits/visitRoutes";
import orderRoutes from "./modules/orders/orderRoutes";
import productRoutes from "./modules/products/productRoutes";
import adminProductRoutes from "./modules/products/adminProductRoutes";
import distributionPartnerRoutes from "./modules/distributionPartners/distributionPartnerRoutes";
import mappingRoutes from "./modules/mappings/mappingRoutes";
import adminEmployeeRoutes from "./modules/employees/adminEmployeeRoutes";
import systemSettingsRoutes from "./modules/settings/systemSettingsRoutes";
import bulkUploadRoutes from "./modules/bulkUpload/bulkUploadRoutes";
import statusLogRoutes from "./modules/statusLog/statusLogRoutes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Mobile-facing (any authenticated employee, scoped to themselves via the
  // mapping tables — see requireAuth / each service's ownership checks).
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/me", beatRoutes);
  app.use("/api/v1/retailers", retailerRoutes);
  app.use("/api/v1/retailer-subcategories", retailerSubcategoryRoutes);
  app.use("/api/v1/visits", visitRoutes);
  app.use("/api/v1/orders", orderRoutes);
  app.use("/api/v1/distributors", productRoutes);

  // Admin-only (requireRole("ADMIN") applied inside each router) — spec §11
  // "Admin owns all mapping creation/removal," §3/§4 codes and status.
  app.use("/api/v1/admin/distribution-partners", distributionPartnerRoutes);
  app.use("/api/v1/admin/retailers", adminRetailerRoutes);
  app.use("/api/v1/admin/beats", adminBeatRoutes);
  app.use("/api/v1/admin/mappings", mappingRoutes);
  app.use("/api/v1/admin/employees", adminEmployeeRoutes);
  app.use("/api/v1/admin/products", adminProductRoutes);
  app.use("/api/v1/admin/settings", systemSettingsRoutes);
  app.use("/api/v1/admin/bulk-upload", bulkUploadRoutes);
  app.use("/api/v1/admin/status-log", statusLogRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
