import { ApiError } from "../../lib/errors";
import * as repo from "./distributionPartnerRepository";
import * as statusLogRepo from "../statusLog/statusLogRepository";
import type { DistributionPartnerSummary, DistributionPartnerType } from "@flowmint/shared";

function toSummary(row: repo.DistributionPartnerRow): DistributionPartnerSummary {
  return {
    id: row.id,
    partnerType: row.partner_type,
    parentPartnerId: row.parent_partner_id,
    code: row.code,
    name: row.name,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    addressLine: row.address_line,
    city: row.city,
    pincode: row.pincode,
    // Derived, not stored — spec §2.1: Super/Direct billed by the company
    // directly; Sub billed by its parent Super Distributor.
    billedBy: row.partner_type === "SUB_DISTRIBUTOR" ? (row.parent_partner_id as string) : "COMPANY",
    isActive: row.is_active,
  };
}

export async function createPartner(
  companyId: string,
  params: {
    partnerType: DistributionPartnerType;
    code?: string;
    parentPartnerId?: string;
    name: string;
    contactName?: string;
    contactPhone?: string;
    addressLine?: string;
    city?: string;
    pincode?: string;
  }
): Promise<DistributionPartnerSummary> {
  // partnerType-conditional shape (code required except for Sub; parent
  // required only for Sub) is already enforced by the zod schema — this is
  // the additional business-rule check that a schema can't express: the
  // parent must actually exist, be active, and be a Super Distributor
  // (spec §2.1).
  let parentPartnerId: string | null = null;
  if (params.partnerType === "SUB_DISTRIBUTOR") {
    const parent = await repo.findById(params.parentPartnerId as string);
    if (!parent || !parent.is_active) {
      throw new ApiError(400, "PARENT_PARTNER_NOT_FOUND", "parentPartnerId does not refer to an active distribution partner.");
    }
    if (parent.partner_type !== "SUPER_DISTRIBUTOR") {
      throw new ApiError(400, "INVALID_PARENT_PARTNER_TYPE", "A Sub Distributor's parent must be a Super Distributor.");
    }
    parentPartnerId = parent.id;
  }

  if (params.code) {
    const existing = await repo.findByCode(params.code);
    if (existing) {
      throw new ApiError(409, "CODE_ALREADY_IN_USE", `Code ${params.code} is already in use.`);
    }
  }

  const row = await repo.create({
    companyId,
    partnerType: params.partnerType,
    code: params.partnerType === "SUB_DISTRIBUTOR" ? null : (params.code as string),
    parentPartnerId,
    name: params.name,
    contactName: params.contactName ?? null,
    contactPhone: params.contactPhone ?? null,
    addressLine: params.addressLine ?? null,
    city: params.city ?? null,
    pincode: params.pincode ?? null,
  });
  return toSummary(row);
}

export async function listPartners(filter: {
  partnerType?: DistributionPartnerType;
  isActive?: boolean;
}): Promise<DistributionPartnerSummary[]> {
  const rows = await repo.list(filter);
  return rows.map(toSummary);
}

export async function getPartner(id: string): Promise<DistributionPartnerSummary> {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, "DISTRIBUTION_PARTNER_NOT_FOUND", "Distribution partner not found.");
  return toSummary(row);
}

export async function setPartnerStatus(
  id: string,
  changedByEmployeeId: string,
  isActive: boolean,
  reason?: string
): Promise<DistributionPartnerSummary> {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, "DISTRIBUTION_PARTNER_NOT_FOUND", "Distribution partner not found.");
  if (existing.is_active === isActive) return toSummary(existing);

  const updated = await repo.setStatus(id, isActive);
  if (!updated) throw new ApiError(404, "DISTRIBUTION_PARTNER_NOT_FOUND", "Distribution partner not found.");

  await statusLogRepo.recordStatusChange({
    entityType: "DISTRIBUTION_PARTNER",
    entityId: id,
    previousStatus: existing.is_active,
    newStatus: isActive,
    changedByEmployeeId,
    reason,
  });

  return toSummary(updated);
}
