import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string; // employee id
  employeeCode: string;
  role: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string; // employee id
  tokenVersion: number;
  type: "refresh";
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  const options: jwt.SignOptions = { expiresIn: env.jwt.accessTtl as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, type: "access" }, env.jwt.accessSecret, options);
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">): string {
  const options: jwt.SignOptions = { expiresIn: env.jwt.refreshTtl as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, type: "refresh" }, env.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
  if (decoded.type !== "access") throw new Error("Not an access token");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
  if (decoded.type !== "refresh") throw new Error("Not a refresh token");
  return decoded;
}

// Short-lived, single-purpose tokens for the two OTP flows. Not JWTs re-used
// across flows — a retailer-creation verification token cannot be replayed
// as a password-reset token because the secrets and payload shapes differ.

export interface ResetTokenPayload {
  sub: string; // employee id
  otpVerificationId: string;
  purpose: "PASSWORD_RESET";
}

export function signResetToken(payload: ResetTokenPayload): string {
  return jwt.sign(payload, env.resetTokenSecret, { expiresIn: "10m" });
}

export function verifyResetToken(token: string): ResetTokenPayload {
  return jwt.verify(token, env.resetTokenSecret) as ResetTokenPayload;
}

export interface VerificationTokenPayload {
  phone: string;
  otpVerificationId: string;
  purpose: "RETAILER_CREATION";
}

export function signVerificationToken(payload: VerificationTokenPayload): string {
  return jwt.sign(payload, env.verificationTokenSecret, { expiresIn: "10m" });
}

export function verifyVerificationToken(token: string): VerificationTokenPayload {
  return jwt.verify(token, env.verificationTokenSecret) as VerificationTokenPayload;
}
