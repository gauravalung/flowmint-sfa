import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { todayBeatHandler, listBeatsForDistributorHandler, listBeatRetailersHandler } from "./beatController";

// Mounted at /api/v1 directly (not /api/v1/me) so this one router can also
// own /beats/:id/retailers, which isn't a "/me/..." shaped resource.
const router = Router();

router.get("/me/beat/today", requireAuth, todayBeatHandler as any);
router.get("/me/distributors/:distributorId/beats", requireAuth, listBeatsForDistributorHandler as any);
router.get("/beats/:id/retailers", requireAuth, listBeatRetailersHandler as any);

export default router;
