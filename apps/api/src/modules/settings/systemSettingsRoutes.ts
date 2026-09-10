import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { listHandler, updateHandler } from "./systemSettingsController";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", listHandler as any);
router.put("/:key", updateHandler as any);

export default router;
