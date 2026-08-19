import { pool } from "../../db/pool";

export type OtpPurpose = "RETAILER_CREATION" | "PASSWORD_RESET";

export interface OtpRow {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  otp_hash: string;
  expires_at: Date;
  attempt_count: number;
  verified_at: Date | null;
  employee_id: string | null;
  created_at: Date;
}

export async function insertOtp(params: {
  phone: string;
  purpose: OtpPurpose;
  otpHash: string;
  expiresAt: Date;
  employeeId?: string;
}): Promise<OtpRow> {
  const { rows } = await pool.query<OtpRow>(
    `INSERT INTO otp_verifications (phone, purpose, otp_hash, expires_at, employee_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [params.phone, params.purpose, params.otpHash, params.expiresAt, params.employeeId ?? null]
  );
  return rows[0];
}

export async function findLatestOtp(phone: string, purpose: OtpPurpose): Promise<OtpRow | null> {
  const { rows } = await pool.query<OtpRow>(
    `SELECT * FROM otp_verifications
     WHERE phone = $1 AND purpose = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, purpose]
  );
  return rows[0] ?? null;
}

export async function incrementAttempt(id: string): Promise<void> {
  await pool.query(`UPDATE otp_verifications SET attempt_count = attempt_count + 1 WHERE id = $1`, [id]);
}

export async function markVerified(id: string): Promise<void> {
  await pool.query(`UPDATE otp_verifications SET verified_at = now() WHERE id = $1`, [id]);
}

export async function findVerifiedOtpById(id: string): Promise<OtpRow | null> {
  const { rows } = await pool.query<OtpRow>(
    `SELECT * FROM otp_verifications WHERE id = $1 AND verified_at IS NOT NULL`,
    [id]
  );
  return rows[0] ?? null;
}
