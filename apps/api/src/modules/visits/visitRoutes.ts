import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { startVisitHandler, closeVisitHandler } from "./visitController";

const router = Router();

router.post("/", requireAuth, startVisitHandler as any);
router.post("/:id/close", requireAuth, closeVisitHandler as any);

export default router;
