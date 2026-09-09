import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import {
  createOrderHandler,
  getOrderHandler,
  listMyOrdersHandler,
  cancelOrderHandler,
  deliverOrderHandler,
} from "./orderController";

const router = Router();

router.post("/", requireAuth, createOrderHandler as any);
router.get("/mine", requireAuth, listMyOrdersHandler as any);
router.get("/:id", requireAuth, getOrderHandler as any);
router.post("/:id/cancel", requireAuth, cancelOrderHandler as any);
router.post("/:id/deliver", requireAuth, requireRole("ADMIN"), deliverOrderHandler as any);

export default router;
