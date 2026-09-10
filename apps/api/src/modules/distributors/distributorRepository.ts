import { pool } from "../../db/pool";

export interface DistributorRow {
  id: string;
  company_id: string;
  name: string;
  code: string;
}

export async function findForEmployee(employeeId: string): Promise<DistributorRow[]> {
  const { rows } = await pool.query<DistributorRow>(
    `SELECT d.id, d.company_id, d.name, d.code
     FROM employee_distributor_mapping m
     JOIN distributors d ON d.id = m.distributor_id AND d.is_active = true
     WHERE m.employee_id = $1 AND m.is_active = true
     ORDER BY d.name ASC`,
    [employeeId]
  );
  return rows;
}

export async function hasAccess(employeeId: string, distributorId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM employee_distributor_mapping
     WHERE employee_id = $1 AND distributor_id = $2 AND is_active = true
     LIMIT 1`,
    [employeeId, distributorId]
  );
  return rows.length > 0;
}
