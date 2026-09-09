import { ApiError } from "../../lib/errors";
import * as mappingRepo from "./mappingRepository";
import * as partnerRepo from "../distributionPartners/distributionPartnerRepository";
import * as beatRepo from "../beats/beatRepository";
import * as retailerRepo from "../retailers/retailerRepository";
import * as employeeRepo from "../employees/employeeRepository";
import type { MappingSummary } from "@flowmint/shared";

function toSummary(row: mappingRepo.MappingRow): MappingSummary {
  return {
    id: row.id,
    isActive: row.is_active,
    deactivatedAt: row.deactivated_at ? row.deactivated_at.toISOString() : null,
  };
}

async function requirePartner(id: string) {
  const row = await partnerRepo.findById(id);
  if (!row || !row.is_active) throw new ApiError(404, "DISTRIBUTION_PARTNER_NOT_FOUND", "Distribution partner not found or inactive.");
}

async function requireBeat(id: string) {
  const row = await beatRepo.findById(id);
  if (!row || !row.is_active) throw new ApiError(404, "BEAT_NOT_FOUND", "Beat not found or inactive.");
}

async function requireRetailer(id: string) {
  const row = await retailerRepo.findById(id);
  if (!row || !row.is_active) throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found or inactive.");
}

async function requireEmployee(id: string) {
  const row = await employeeRepo.findById(id);
  if (!row || !row.is_active) throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found or inactive.");
}

export async function mapDistributionPartnerBeat(distributionPartnerId: string, beatId: string): Promise<MappingSummary> {
  await requirePartner(distributionPartnerId);
  await requireBeat(beatId);
  return toSummary(await mappingRepo.mapDistributionPartnerBeat(distributionPartnerId, beatId));
}

export async function unmapDistributionPartnerBeat(id: string): Promise<void> {
  const ok = await mappingRepo.unmapDistributionPartnerBeat(id);
  if (!ok) throw new ApiError(404, "MAPPING_NOT_FOUND", "Mapping not found or already removed.");
}

export async function mapBeatRetailer(
  beatId: string,
  retailerId: string,
  sequenceNo?: number
): Promise<MappingSummary> {
  await requireBeat(beatId);
  await requireRetailer(retailerId);
  try {
    return toSummary(await mappingRepo.mapBeatRetailerWithCapCheck(beatId, retailerId, sequenceNo ?? null));
  } catch (err) {
    if (err instanceof mappingRepo.BeatCapacityExceededError) {
      throw new ApiError(409, "BEAT_CAPACITY_EXCEEDED", `A beat can have at most ${mappingRepo.BEAT_RETAILER_CAP} active retailers.`);
    }
    throw err;
  }
}

export async function unmapBeatRetailer(id: string): Promise<void> {
  const ok = await mappingRepo.unmapBeatRetailer(id);
  if (!ok) throw new ApiError(404, "MAPPING_NOT_FOUND", "Mapping not found or already removed.");
}

export async function mapRetailerDistributionPartner(retailerId: string, distributionPartnerId: string): Promise<MappingSummary> {
  await requireRetailer(retailerId);
  await requirePartner(distributionPartnerId);
  return toSummary(await mappingRepo.mapRetailerDistributionPartner(retailerId, distributionPartnerId));
}

export async function unmapRetailerDistributionPartner(id: string): Promise<void> {
  const ok = await mappingRepo.unmapRetailerDistributionPartner(id);
  if (!ok) throw new ApiError(404, "MAPPING_NOT_FOUND", "Mapping not found or already removed.");
}

export async function mapEmployeeDistributionPartner(employeeId: string, distributionPartnerId: string): Promise<MappingSummary> {
  await requireEmployee(employeeId);
  await requirePartner(distributionPartnerId);
  return toSummary(await mappingRepo.mapEmployeeDistributionPartner(employeeId, distributionPartnerId));
}

export async function unmapEmployeeDistributionPartner(id: string): Promise<void> {
  const ok = await mappingRepo.unmapEmployeeDistributionPartner(id);
  if (!ok) throw new ApiError(404, "MAPPING_NOT_FOUND", "Mapping not found or already removed.");
}

export async function mapEmployeeBeat(employeeId: string, beatId: string, dayOfWeek?: number): Promise<MappingSummary> {
  await requireEmployee(employeeId);
  await requireBeat(beatId);
  return toSummary(await mappingRepo.mapEmployeeBeat(employeeId, beatId, dayOfWeek ?? null));
}

export async function unmapEmployeeBeat(id: string): Promise<void> {
  const ok = await mappingRepo.unmapEmployeeBeat(id);
  if (!ok) throw new ApiError(404, "MAPPING_NOT_FOUND", "Mapping not found or already removed.");
}

export async function mapEmployeeRetailer(employeeId: string, retailerId: string): Promise<MappingSummary> {
  await requireEmployee(employeeId);
  await requireRetailer(retailerId);
  return toSummary(await mappingRepo.mapEmployeeRetailer(employeeId, retailerId));
}

export async function unmapEmployeeRetailer(id: string): Promise<void> {
  const ok = await mappingRepo.unmapEmployeeRetailer(id);
  if (!ok) throw new ApiError(404, "MAPPING_NOT_FOUND", "Mapping not found or already removed.");
}
