import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { createOrderSchema } from "@flowmint/shared";
import * as orderService from "./orderService";

export async function createOrderHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = createOrderSchema.parse(req.body);
    const result = await orderService.createOrder(req.employee.id, body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
