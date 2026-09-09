import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { listHandler, createHandler, setStatusHandler } from "./retailerSubcategoryController";

const router = Router();

// Listing is useful to any authenticated caller (e.g. the mobile app
// populating the Add Outlet form's subcategory picker) — only
// create/deactivate are admin-only.
router.get("/", requireAuth, listHandler as any);
router.post("/", requireAuth, requireRole("ADMIN"), createHandler as any);
router.patch("/:id/status", requireAuth, requireRole("ADMIN"), setStatusHandler as any);

export default router;
