import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { createOrderHandler } from "./orderController";

const router = Router();

router.post("/", requireAuth, createOrderHandler as any);

export default router;
