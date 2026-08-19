import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { startVisitSchema, closeVisitSchema } from "@flowmint/shared";
import * as visitService from "./visitService";

export async function startVisitHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = startVisitSchema.parse(req.body);
    const result = await visitService.startVisit(req.employee.id, body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function closeVisitHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = closeVisitSchema.parse(req.body);
    const result = await visitService.closeVisit(req.employee.id, req.params.id, body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
