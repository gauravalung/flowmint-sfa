import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { distributorCatalogHandler } from "./productController";

const router = Router();

// Mounted at /api/v1/distributors — mobile "Place New Order" catalog,
// spec §8.6. Any authenticated employee can view a distributor's catalog;
// order submission (orderRoutes) is what actually needs the employee to
// be mapped to that distributor.
router.get("/:id/products", requireAuth, distributorCatalogHandler as any);

export default router;
