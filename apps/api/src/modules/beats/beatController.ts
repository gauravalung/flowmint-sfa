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

export async function myDistributorsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await beatService.listMyDistributors(req.employee.id);
    res.json({ distributors: result });
  } catch (err) {
    next(err);
  }
}

export async function myDistributorBeatsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await beatService.listMyBeatsForDistributor(req.employee.id, req.params.distributorId);
    res.json({ beats: result });
  } catch (err) {
    next(err);
  }
}

export async function beatRetailersHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await beatService.listBeatRetailers(req.params.beatId);
    res.json({ retailers: result });
  } catch (err) {
    next(err);
  }
}
