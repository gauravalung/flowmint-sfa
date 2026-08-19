import bcrypt from "bcryptjs";
import * as employeeRepo from "../employees/employeeRepository";
import { toPublicEmployee } from "../employees/employeeService";
import * as otpService from "../otp/otpService";
import { ApiError, invalidCredentialsError, invalidOtpError } from "../../lib/errors";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signResetToken,
  verifyResetToken,
} from "../../lib/jwt";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function login(employeeCode: string, password: string) {
  const employee = await employeeRepo.findByEmployeeCode(employeeCode);

  // Deliberately generic: "not found," "wrong password," and "locked" all
  // produce the same response. See lib/errors.ts for the trade-off note.
  if (!employee || !employee.is_active) {
    throw invalidCredentialsError();
  }

  if (employee.locked_until && employee.locked_until.getTime() > Date.now()) {
    throw invalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(password, employee.password_hash);
  if (!passwordMatches) {
    const nextAttempts = employee.failed_login_attempts + 1;
    const lockUntil = nextAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;
    await employeeRepo.recordFailedLogin(employee.id, lockUntil);
    throw invalidCredentialsError();
  }

  await employeeRepo.recordSuccessfulLogin(employee.id);

  const accessToken = signAccessToken({
    sub: employee.id,
    employeeCode: employee.employee_code,
    role: employee.role,
  });
  const refreshToken = signRefreshToken({
    sub: employee.id,
    tokenVersion: employee.refresh_token_version,
  });

  return {
    accessToken,
    refreshToken,
    employee: toPublicEmployee(employee),
  };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "AUTH_INVALID_REFRESH", "Invalid or expired refresh token.");
  }

  const employee = await employeeRepo.findById(payload.sub);
  if (!employee || !employee.is_active || employee.refresh_token_version !== payload.tokenVersion) {
    // Token version mismatch means a password reset (or future admin action)
    // revoked this token — treat it exactly like an invalid token.
    throw new ApiError(401, "AUTH_INVALID_REFRESH", "Invalid or expired refresh token.");
  }

  const accessToken = signAccessToken({
    sub: employee.id,
    employeeCode: employee.employee_code,
    role: employee.role,
  });
  const newRefreshToken = signRefreshToken({
    sub: employee.id,
    tokenVersion: employee.refresh_token_version,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function requestPasswordReset(employeeCode: string): Promise<void> {
  const employee = await employeeRepo.findByEmployeeCode(employeeCode);
  // Always the same response whether or not the code exists — see
  // requestPasswordReset's caller (authController) for the generic reply.
  // Only actually send an OTP if there's a real, active employee.
  if (employee && employee.is_active) {
    await otpService.requestOtp(employee.phone, "PASSWORD_RESET", employee.id);
  }
}

export async function verifyPasswordResetOtp(employeeCode: string, otp: string): Promise<string> {
  const employee = await employeeRepo.findByEmployeeCode(employeeCode);
  if (!employee || !employee.is_active) {
    // Same error shape as a genuinely wrong OTP — no enumeration signal.
    throw invalidOtpError();
  }
  const otpVerificationId = await otpService.verifyOtp(employee.phone, "PASSWORD_RESET", otp);
  return signResetToken({ sub: employee.id, otpVerificationId, purpose: "PASSWORD_RESET" });
}

export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  let payload;
  try {
    payload = verifyResetToken(resetToken);
  } catch {
    throw new ApiError(400, "AUTH_INVALID_RESET_TOKEN", "This reset link has expired. Start again.");
  }

  await otpService.assertOtpVerified(payload.otpVerificationId);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await employeeRepo.updatePasswordAndBumpTokenVersion(payload.sub, passwordHash);
  // Bumping refresh_token_version above logs out every other session —
  // deliberate: a password reset should not leave old sessions valid.
}
