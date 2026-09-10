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
import * as mappingRepo from "./mappingRepository";
import { ApiError } from "../../lib/errors";

function requireQueryParam(req: AuthenticatedRequest, name: string): string {
  const value = req.query[name];
  if (typeof value !== "string" || !value) {
    throw new ApiError(400, "QUERY_PARAM_REQUIRED", `Query parameter '${name}' is required.`);
  }
  return value;
}

export async function listBeatsForDistributionPartnerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const distributionPartnerId = requireQueryParam(req, "distributionPartnerId");
    res.json({ mappings: await mappingRepo.listBeatsForDistributionPartner(distributionPartnerId) });
  } catch (err) {
    next(err);
  }
}

export async function listRetailersForBeatHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const beatId = requireQueryParam(req, "beatId");
    res.json({ mappings: await mappingRepo.listRetailersForBeat(beatId) });
  } catch (err) {
    next(err);
  }
}

export async function listDistributionPartnersForRetailerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const retailerId = requireQueryParam(req, "retailerId");
    res.json({ mappings: await mappingRepo.listDistributionPartnersForRetailer(retailerId) });
  } catch (err) {
    next(err);
  }
}

export async function listDistributionPartnersForEmployeeHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = requireQueryParam(req, "employeeId");
    res.json({ mappings: await mappingRepo.listDistributionPartnersForEmployee(employeeId) });
  } catch (err) {
    next(err);
  }
}

export async function listBeatsForEmployeeHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = requireQueryParam(req, "employeeId");
    res.json({ mappings: await mappingRepo.listBeatsForEmployee(employeeId) });
  } catch (err) {
    next(err);
  }
}

export async function listRetailersForEmployeeHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = requireQueryParam(req, "employeeId");
    res.json({ mappings: await mappingRepo.listRetailersForEmployee(employeeId) });
  } catch (err) {
    next(err);
  }
}

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
