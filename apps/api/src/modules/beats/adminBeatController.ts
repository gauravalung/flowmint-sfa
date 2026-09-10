import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { createBeatSchema } from "@flowmint/shared";
import * as beatService from "./beatService";

export async function createHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = createBeatSchema.parse(req.body);
    const result = await beatService.createBeat(req.employee.companyId, body.name, body.code);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
    const result = await beatService.listBeats(isActive);
    res.json({ beats: result });
  } catch (err) {
    next(err);
  }
}

export async function setStatusHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const isActive = Boolean(req.body?.isActive);
    const result = await beatService.setBeatStatus(req.params.id, isActive);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
