import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import {
  distributionPartnerBeatMappingSchema,
  beatRetailerMappingSchema,
  retailerDistributionPartnerMappingSchema,
  employeeDistributionPartnerMappingSchema,
  employeeBeatMappingSchema,
  employeeRetailerMappingSchema,
} from "@flowmint/shared";
import * as service from "./mappingService";

export async function mapDistributionPartnerBeatHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = distributionPartnerBeatMappingSchema.parse(req.body);
    const result = await service.mapDistributionPartnerBeat(body.distributionPartnerId, body.beatId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function unmapDistributionPartnerBeatHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await service.unmapDistributionPartnerBeat(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function mapBeatRetailerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = beatRetailerMappingSchema.parse(req.body);
    const result = await service.mapBeatRetailer(body.beatId, body.retailerId, body.sequenceNo);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function unmapBeatRetailerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await service.unmapBeatRetailer(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function mapRetailerDistributionPartnerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = retailerDistributionPartnerMappingSchema.parse(req.body);
    const result = await service.mapRetailerDistributionPartner(body.retailerId, body.distributionPartnerId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function unmapRetailerDistributionPartnerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await service.unmapRetailerDistributionPartner(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function mapEmployeeDistributionPartnerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = employeeDistributionPartnerMappingSchema.parse(req.body);
    const result = await service.mapEmployeeDistributionPartner(body.employeeId, body.distributionPartnerId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function unmapEmployeeDistributionPartnerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await service.unmapEmployeeDistributionPartner(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function mapEmployeeBeatHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = employeeBeatMappingSchema.parse(req.body);
    const result = await service.mapEmployeeBeat(body.employeeId, body.beatId, body.dayOfWeek);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function unmapEmployeeBeatHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await service.unmapEmployeeBeat(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function mapEmployeeRetailerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = employeeRetailerMappingSchema.parse(req.body);
    const result = await service.mapEmployeeRetailer(body.employeeId, body.retailerId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function unmapEmployeeRetailerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await service.unmapEmployeeRetailer(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
