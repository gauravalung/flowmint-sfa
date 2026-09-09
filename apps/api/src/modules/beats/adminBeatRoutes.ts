import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { createHandler, listHandler, setStatusHandler } from "./adminBeatController";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.post("/", createHandler as any);
router.get("/", listHandler as any);
router.patch("/:id/status", setStatusHandler as any);

export default router;
