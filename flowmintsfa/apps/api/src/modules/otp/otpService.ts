import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { ApiError } from "../../lib/errors";
import { getOtpProvider } from "./otpProvider";
import * as otpRepo from "./otpRepository";
import type { OtpPurpose } from "./otpRepository";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;

function generateOtp(): string {
  // Cryptographically random 6-digit code, not Math.random().
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function requestOtp(phone: string, purpose: OtpPurpose, employeeId?: string): Promise<void> {
  const latest = await otpRepo.findLatestOtp(phone, purpose);
  if (latest && Date.now() - latest.created_at.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (Date.now() - latest.created_at.getTime())) / 1000
    );
    throw new ApiError(429, "OTP_COOLDOWN", `Please wait ${waitSeconds}s before requesting another OTP.`);
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await otpRepo.insertOtp({ phone, purpose, otpHash, expiresAt, employeeId });

  // OTP is never logged in plaintext anywhere except the dev console
  // provider itself (see otpProvider.ts) — not here.
  await getOtpProvider().send(phone, otp);
}

/**
 * Verifies an OTP and returns the otp_verifications row id on success.
 * Throws ApiError on invalid/expired/too-many-attempts.
 */
export async function verifyOtp(phone: string, purpose: OtpPurpose, otp: string): Promise<string> {
  const latest = await otpRepo.findLatestOtp(phone, purpose);
  if (!latest || latest.verified_at) {
    throw new ApiError(400, "OTP_INVALID_OR_EXPIRED", "Invalid or expired OTP.");
  }
  if (latest.attempt_count >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "OTP_TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Request a new OTP.");
  }
  if (latest.expires_at.getTime() < Date.now()) {
    throw new ApiError(400, "OTP_INVALID_OR_EXPIRED", "Invalid or expired OTP.");
  }

  const matches = await bcrypt.compare(otp, latest.otp_hash);
  if (!matches) {
    await otpRepo.incrementAttempt(latest.id);
    throw new ApiError(400, "OTP_INVALID_OR_EXPIRED", "Invalid or expired OTP.");
  }

  await otpRepo.markVerified(latest.id);
  return latest.id;
}

export async function assertOtpVerified(otpVerificationId: string): Promise<void> {
  const row = await otpRepo.findVerifiedOtpById(otpVerificationId);
  if (!row) {
    throw new ApiError(400, "OTP_INVALID_OR_EXPIRED", "OTP verification is no longer valid.");
  }
}
