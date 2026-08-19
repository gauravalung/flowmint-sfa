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
