import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import {
  createDistributionPartnerSchema,
  distributionPartnerStatusSchema,
  distributionPartnerTypeSchema,
} from "@flowmint/shared";
import * as service from "./distributionPartnerService";

export async function createHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = createDistributionPartnerSchema.parse(req.body);
    // companyId comes from the caller's own access token, never the
    // request body — see requireAuth.ts.
    const result = await service.createPartner(req.employee.companyId, body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const partnerType = req.query.partnerType
      ? distributionPartnerTypeSchema.parse(req.query.partnerType)
      : undefined;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
    const result = await service.listPartners({ partnerType, isActive });
    res.json({ partners: result });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.getPartner(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setStatusHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = distributionPartnerStatusSchema.parse(req.body);
    const result = await service.setPartnerStatus(req.params.id, req.employee.id, body.isActive, body.reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
