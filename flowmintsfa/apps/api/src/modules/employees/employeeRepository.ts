import { pool } from "../../db/pool";

export interface EmployeeRow {
  id: string;
  company_id: string;
  distributor_id: string | null;
  employee_code: string;
  name: string;
  phone: string;
  role: "SALESMAN";
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
  distributorId: string | null;
  employeeCode: string;
  name: string;
  phone: string;
  passwordHash: string;
}): Promise<EmployeeRow> {
  const { rows } = await pool.query<EmployeeRow>(
    `INSERT INTO employees (company_id, distributor_id, employee_code, name, phone, role, password_hash)
     VALUES ($1, $2, $3, $4, $5, 'SALESMAN', $6)
     RETURNING *`,
    [params.companyId, params.distributorId, params.employeeCode, params.name, params.phone, params.passwordHash]
  );
  return rows[0];
}
