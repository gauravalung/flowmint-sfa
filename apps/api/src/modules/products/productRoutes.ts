import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { listProductsHandler, listCategoriesHandler } from "./productController";

const router = Router();

router.get("/", requireAuth, listProductsHandler as any);
router.get("/categories", requireAuth, listCategoriesHandler as any);

export default router;
