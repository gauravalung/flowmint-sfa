import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { createOrderSchema, deliverOrderSchema } from "@flowmint/shared";
import * as orderService from "./orderService";

export async function createOrderHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = createOrderSchema.parse(req.body);
    const result = await orderService.createOrder(req.employee.id, req.employee.companyId, body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOrderHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await orderService.getOrder(req.employee.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listMyOrdersHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await orderService.listMyRecentOrders(req.employee.id);
    res.json({ orders: result });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrderHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await orderService.cancelOrder(req.employee.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Distributor-side fulfillment action (spec §8.7). Any authenticated
// employee can call it in this slice — there is no distributor-portal
// identity yet (Phase 1's admin portal, not built this slice); admin role
// is the closest available gate, so it's required here to avoid leaving
// this endpoint wide open to any salesman.
export async function deliverOrderHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = deliverOrderSchema.parse(req.body);
    const result = await orderService.deliverOrder(req.params.id, body.items ?? []);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
