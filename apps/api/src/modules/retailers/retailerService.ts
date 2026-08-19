import { ApiError } from "../../lib/errors";
import * as retailerRepo from "./retailerRepository";
import * as employeeRepo from "../employees/employeeRepository";
import * as otpService from "../otp/otpService";
import { verifyVerificationToken, signVerificationToken } from "../../lib/jwt";
import type { RetailerSummary } from "@flowmint/shared";

function toSummary(row: retailerRepo.RetailerRow): RetailerSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    ownerName: row.owner_name,
    addressLine: row.address_line,
    city: row.city,
    pincode: row.pincode,
    phone: row.phone,
  };
}

async function requireEmployeeDistributor(employeeId: string): Promise<{
  companyId: string;
  distributorId: string;
}> {
  const employee = await employeeRepo.findById(employeeId);
  // distributor_id is nullable on employees in general, but every provisioned
  // salesman is assigned one — a salesman with none can't have a beat or
  // book anything, so this is a real data-integrity error, not a user error.
  if (!employee || !employee.distributor_id) {
    throw new ApiError(500, "EMPLOYEE_NOT_ASSIGNED", "Your account is not assigned to a distributor.");
  }
  return { companyId: employee.company_id, distributorId: employee.distributor_id };
}

export async function getRetailerDetail(employeeId: string, retailerId: string): Promise<RetailerSummary> {
  const { distributorId } = await requireEmployeeDistributor(employeeId);
  const retailer = await retailerRepo.findById(retailerId);
  if (!retailer || retailer.distributor_id !== distributorId) {
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
  const { distributorId } = await requireEmployeeDistributor(employeeId);
  const { rows, total } = await retailerRepo.searchRetailers(distributorId, search.trim(), page, pageSize);
  return { retailers: rows.map(toSummary), total, page, pageSize };
}

const GENERIC_OTP_REQUEST_MESSAGE = "An OTP has been sent to this phone number.";

export async function requestOutletOtp(phone: string): Promise<void> {
  // Unlike password-reset, there's no account to enumerate here — the phone
  // belongs to a prospective retailer, not a system user — so this can be a
  // real "sent" confirmation rather than the deliberately generic wording
  // used for auth. Still worth a duplicate-active-retailer check up front.
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

export async function createFieldRetailer(
  employeeId: string,
  params: {
    verificationToken: string;
    name: string;
    ownerName?: string;
    addressLine?: string;
    city?: string;
    pincode?: string;
    phone: string;
  }
): Promise<RetailerSummary> {
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

  const { companyId, distributorId } = await requireEmployeeDistributor(employeeId);

  const existing = await retailerRepo.findActiveByPhone(params.phone);
  if (existing) {
    throw new ApiError(409, "RETAILER_PHONE_ALREADY_REGISTERED", "This phone number is already registered to a retailer.");
  }

  const retailer = await retailerRepo.createRetailer({
    companyId,
    distributorId,
    name: params.name,
    ownerName: params.ownerName ?? null,
    addressLine: params.addressLine ?? null,
    city: params.city ?? null,
    pincode: params.pincode ?? null,
    phone: params.phone,
    createdByEmployeeId: employeeId,
  });
  return toSummary(retailer);
}
