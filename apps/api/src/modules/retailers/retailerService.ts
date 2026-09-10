import { ApiError } from "../../lib/errors";
import * as retailerRepo from "./retailerRepository";
import * as beatRepo from "../beats/beatRepository";
import * as mappingRepo from "../mappings/mappingRepository";
import * as statusLogRepo from "../statusLog/statusLogRepository";
import * as otpService from "../otp/otpService";
import * as settingsService from "../settings/systemSettingsService";
import { verifyVerificationToken, signVerificationToken } from "../../lib/jwt";
import type { RetailerSummary, RetailerCategory } from "@flowmint/shared";

function toSummary(row: retailerRepo.RetailerRowWithSubcategory | retailerRepo.RetailerRow): RetailerSummary {
  const withSub = row as retailerRepo.RetailerRowWithSubcategory;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    ownerName: row.owner_name,
    category: row.category,
    subcategoryId: row.subcategory_id,
    subcategoryName: withSub.subcategory_name ?? null,
    addressLine: row.address_line,
    city: row.city,
    pincode: row.pincode,
    phone: row.phone,
    latitude: row.latitude,
    longitude: row.longitude,
    isActive: row.is_active,
  };
}

export async function getRetailerDetail(employeeId: string, retailerId: string): Promise<RetailerSummary> {
  const retailer = await retailerRepo.findById(retailerId);
  if (!retailer || !retailer.is_active) {
    throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found.");
  }
  const accessible = await retailerRepo.isRetailerAccessibleToEmployee(employeeId, retailerId);
  if (!accessible) {
    throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found.");
  }
  return toSummary(retailer);
}

export async function searchRetailers(
  employeeId: string,
  search: string,
  page: number,
  pageSize: number
): Promise<{ retailers: RetailerSummary[]; total: number; page: number; pageSize: number }> {
  const { rows, total } = await retailerRepo.searchRetailersForEmployee(employeeId, search.trim(), page, pageSize);
  return { retailers: rows.map(toSummary), total, page, pageSize };
}

const GENERIC_OTP_REQUEST_MESSAGE = "An OTP has been sent to this phone number.";

export async function requestOutletOtp(phone: string): Promise<void> {
  const existing = await retailerRepo.findActiveByPhone(phone);
  if (existing) {
    throw new ApiError(409, "RETAILER_PHONE_ALREADY_REGISTERED", "This phone number is already registered to a retailer.");
  }
  await otpService.requestOtp(phone, "RETAILER_CREATION");
}

export async function verifyOutletOtp(phone: string, otp: string): Promise<string> {
  const otpVerificationId = await otpService.verifyOtp(phone, "RETAILER_CREATION", otp);
  return signVerificationToken({ phone, otpVerificationId, purpose: "RETAILER_CREATION" });
}

// Field ("Add New Outlet") creation, spec §8.5 — creates the retailer AND
// its beat_retailer_mapping in one call. OTP verification is required
// unless system_settings.otp_mandatory_for_outlet_creation has been turned
// off (admin, system-wide toggle).
export async function createFieldRetailer(
  employeeId: string,
  companyId: string,
  params: {
    beatId: string;
    verificationToken?: string;
    name: string;
    ownerName?: string;
    category: RetailerCategory;
    subcategoryId?: string;
    addressLine?: string;
    city?: string;
    pincode?: string;
    phone: string;
  }
): Promise<RetailerSummary> {
  const beat = await beatRepo.findById(params.beatId);
  if (!beat || !beat.is_active) {
    throw new ApiError(404, "BEAT_NOT_FOUND", "Beat not found.");
  }

  const otpMandatory = await settingsService.isOtpMandatoryForOutletCreation();
  let phoneVerified = false;

  if (otpMandatory) {
    if (!params.verificationToken) {
      throw new ApiError(400, "VERIFICATION_TOKEN_REQUIRED", "OTP verification is required to create an outlet.");
    }
    let payload;
    try {
      payload = verifyVerificationToken(params.verificationToken);
    } catch {
      throw new ApiError(400, "VERIFICATION_TOKEN_INVALID", "OTP verification has expired. Please verify again.");
    }
    if (payload.purpose !== "RETAILER_CREATION" || payload.phone !== params.phone) {
      throw new ApiError(400, "VERIFICATION_TOKEN_INVALID", "OTP verification does not match this phone number.");
    }
    await otpService.assertOtpVerified(payload.otpVerificationId);
    phoneVerified = true;
  }

  const existing = await retailerRepo.findActiveByPhone(params.phone);
  if (existing) {
    throw new ApiError(409, "RETAILER_PHONE_ALREADY_REGISTERED", "This phone number is already registered to a retailer.");
  }

  const retailer = await retailerRepo.createRetailer({
    companyId,
    code: null,
    name: params.name,
    ownerName: params.ownerName ?? null,
    category: params.category,
    subcategoryId: params.subcategoryId ?? null,
    addressLine: params.addressLine ?? null,
    city: params.city ?? null,
    pincode: params.pincode ?? null,
    phone: params.phone,
    source: "FIELD",
    createdByEmployeeId: employeeId,
    phoneVerified,
  });

  try {
    await mappingRepo.mapBeatRetailerWithCapCheck(params.beatId, retailer.id, null);
  } catch (err) {
    if (err instanceof mappingRepo.BeatCapacityExceededError) {
      throw new ApiError(409, "BEAT_CAPACITY_EXCEEDED", `This beat already has ${mappingRepo.BEAT_RETAILER_CAP} active retailers — the outlet was created but could not be added to the beat. Ask an admin to map it to a different beat.`);
    }
    throw err;
  }

  return toSummary(retailer);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function createAdminRetailer(
  companyId: string,
  createdByEmployeeId: string,
  params: {
    code?: string;
    name: string;
    ownerName?: string;
    category: RetailerCategory;
    subcategoryId?: string;
    addressLine?: string;
    city?: string;
    pincode?: string;
    phone?: string;
  }
): Promise<RetailerSummary> {
  if (params.code) {
    const existing = await retailerRepo.findByCode(params.code);
    if (existing) throw new ApiError(409, "CODE_ALREADY_IN_USE", `Code ${params.code} is already in use.`);
  }
  const retailer = await retailerRepo.createRetailer({
    companyId,
    code: params.code ?? null,
    name: params.name,
    ownerName: params.ownerName ?? null,
    category: params.category,
    subcategoryId: params.subcategoryId ?? null,
    addressLine: params.addressLine ?? null,
    city: params.city ?? null,
    pincode: params.pincode ?? null,
    phone: params.phone ?? null,
    source: "ADMIN",
    createdByEmployeeId,
    phoneVerified: false,
  });
  return toSummary(retailer);
}

export async function listAdminRetailers(filter: {
  isActive?: boolean;
  category?: RetailerCategory;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ retailers: RetailerSummary[]; total: number }> {
  const { rows, total } = await retailerRepo.list(filter);
  return { retailers: rows.map(toSummary), total };
}

export async function setRetailerStatus(
  id: string,
  changedByEmployeeId: string,
  isActive: boolean,
  reason?: string
): Promise<RetailerSummary> {
  const existing = await retailerRepo.findById(id);
  if (!existing) throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found.");
  if (existing.is_active === isActive) return toSummary(existing);

  const updated = await retailerRepo.setStatus(id, isActive);
  if (!updated) throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found.");

  await statusLogRepo.recordStatusChange({
    entityType: "RETAILER",
    entityId: id,
    previousStatus: existing.is_active,
    newStatus: isActive,
    changedByEmployeeId,
    reason,
  });

  return toSummary(updated);
}
