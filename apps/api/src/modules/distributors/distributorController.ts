import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as distributorService from "./distributorService";

export async function listDistributorsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const distributors = await distributorService.listDistributors(req.employee.id);
    res.json({ distributors });
  } catch (err) {
    next(err);
  }
}
