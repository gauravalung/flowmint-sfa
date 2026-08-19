import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { todayBeatHandler } from "./beatController";

const router = Router();

router.get("/beat/today", requireAuth, todayBeatHandler as any);

export default router;
