import { pool } from "../../db/pool";
import type { EmployeeRole } from "@flowmint/shared";

export interface EmployeeRow {
  id: string;
  company_id: string;
  employee_code: string;
  name: string;
  phone: string;
  role: EmployeeRole;
  reporting_manager_id: string | null;
  face_reference_photo_url: string | null;
  password_hash: string;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  refresh_token_version: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function findByEmployeeCode(employeeCode: string): Promise<EmployeeRow | null> {
  const { rows } = await pool.query<EmployeeRow>(
    `SELECT * FROM employees WHERE employee_code = $1`,
    [employeeCode]
  );
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<EmployeeRow | null> {
  const { rows } = await pool.query<EmployeeRow>(`SELECT * FROM employees WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function recordFailedLogin(id: string, lockUntil: Date | null): Promise<void> {
  await pool.query(
    `UPDATE employees
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = COALESCE($2, locked_until),
         updated_at = now()
     WHERE id = $1`,
    [id, lockUntil]
  );
}

export async function recordSuccessfulLogin(id: string): Promise<void> {
  await pool.query(
    `UPDATE employees
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [id]
  );
}

export async function updatePasswordAndBumpTokenVersion(id: string, passwordHash: string): Promise<void> {
  await pool.query(
    `UPDATE employees
     SET password_hash = $2,
         refresh_token_version = refresh_token_version + 1,
         failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = now()
     WHERE id = $1`,
    [id, passwordHash]
  );
}

export async function createEmployee(params: {
  companyId: string;
  employeeCode: string;
  name: string;
  phone: string;
  role: EmployeeRole;
  reportingManagerId: string | null;
  passwordHash: string;
}): Promise<EmployeeRow> {
  const { rows } = await pool.query<EmployeeRow>(
    `INSERT INTO employees (company_id, employee_code, name, phone, role, reporting_manager_id, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      params.companyId,
      params.employeeCode,
      params.name,
      params.phone,
      params.role,
      params.reportingManagerId,
      params.passwordHash,
    ]
  );
  return rows[0];
}

// The employee's downline via a recursive walk of reporting_manager_id
// (spec §2.2/§10) — every employee, at any depth, who ultimately reports up
// to this one. Used by dashboard queries in a later slice; exposed here now
// since it's a property of the employee table's own shape.
export async function findDownlineEmployeeIds(managerId: string): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    `WITH RECURSIVE downline AS (
       SELECT id FROM employees WHERE reporting_manager_id = $1
       UNION ALL
       SELECT e.id FROM employees e
       JOIN downline d ON e.reporting_manager_id = d.id
     )
     SELECT id FROM downline`,
    [managerId]
  );
  return rows.map((r) => r.id);
}
