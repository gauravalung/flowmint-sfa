import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import {
  todayBeatHandler,
  myDistributorsHandler,
  myDistributorBeatsHandler,
  beatRetailersHandler,
} from "./beatController";

const router = Router();

// Mounted at /api/v1/me — mobile navigation flow, spec §8.3/§8.4.
router.get("/beat/today", requireAuth, todayBeatHandler as any);
router.get("/distributors", requireAuth, myDistributorsHandler as any);
router.get("/distributors/:distributorId/beats", requireAuth, myDistributorBeatsHandler as any);
router.get("/beats/:beatId/retailers", requireAuth, beatRetailersHandler as any);

export default router;
