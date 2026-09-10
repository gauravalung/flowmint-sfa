import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { updateSystemSettingSchema } from "@flowmint/shared";
import * as service from "./systemSettingsService";

export async function listHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.listSettings();
    res.json({ settings: result });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = updateSystemSettingSchema.parse(req.body);
    const result = await service.updateSetting(req.params.key, body.value, req.employee.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
