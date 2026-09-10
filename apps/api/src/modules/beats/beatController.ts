import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as beatService from "./beatService";

export async function todayBeatHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await beatService.getTodayBeat(req.employee.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listBeatsForDistributorHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const beats = await beatService.listBeatsForDistributor(req.employee.id, req.params.distributorId);
    res.json({ beats });
  } catch (err) {
    next(err);
  }
}

export async function listBeatRetailersHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await beatService.listBeatRetailers(req.employee.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
