import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { createRetailerAdminSchema, retailerStatusSchema, retailerCategorySchema } from "@flowmint/shared";
import * as retailerService from "./retailerService";

export async function createHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = createRetailerAdminSchema.parse(req.body);
    const result = await retailerService.createAdminRetailer(req.employee.companyId, req.employee.id, body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
    const category = req.query.category ? retailerCategorySchema.parse(req.query.category) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const result = await retailerService.listAdminRetailers({ isActive, category, search, page, pageSize });
    res.json({ ...result, page, pageSize });
  } catch (err) {
    next(err);
  }
}

export async function setStatusHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = retailerStatusSchema.parse(req.body);
    const result = await retailerService.setRetailerStatus(req.params.id, req.employee.id, body.isActive, body.reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
