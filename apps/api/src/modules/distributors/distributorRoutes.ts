import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { listDistributorsHandler } from "./distributorController";

const router = Router();

router.get("/", requireAuth, listDistributorsHandler as any);

export default router;
