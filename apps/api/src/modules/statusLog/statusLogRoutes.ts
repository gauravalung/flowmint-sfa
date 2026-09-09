import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { listHandler, historyForEntityHandler } from "./statusLogController";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

// spec §4: "A report/screen shows all entities with current status and
// status-change history."
router.get("/", listHandler as any);
router.get("/:entityType/:entityId", historyForEntityHandler as any);

export default router;
