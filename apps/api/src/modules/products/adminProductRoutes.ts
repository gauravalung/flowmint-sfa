import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { createHandler, listHandler, setInventoryHandler, listBrandsHandler, listCategoriesHandler } from "./adminProductController";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/brands", listBrandsHandler as any);
router.get("/categories", listCategoriesHandler as any);
router.get("/", listHandler as any);
router.post("/", createHandler as any);
// Mounted alongside /admin/distribution-partners — sets one distributor's
// stock/focus overlay for one product (spec §8.6).
router.put("/distribution-partners/:id/inventory", setInventoryHandler as any);

export default router;
