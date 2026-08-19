import bcrypt from "bcryptjs";
import * as employeeRepo from "./employeeRepository";
import { ApiError } from "../../lib/errors";

/**
 * Provisions a new employee (salesman) login. Called only from the
 * create-employee CLI script in v1 — deliberately NOT exposed over HTTP.
 * See DECISIONS.md 2026-08-18 (round 4): a CLI script has no network-
 * reachable path to account creation at all, which is the smallest
 * attack surface at single-salesman pilot scale. If this is ever promoted
 * to an HTTP endpoint, it should call this exact function — the interface
 * split is already at the service boundary.
 */
export async function provisionEmployee(params: {
  companyId: string;
  distributorId: string | null;
  employeeCode: string;
  name: string;
  phone: string;
  temporaryPassword: string;
}) {
  const existing = await employeeRepo.findByEmployeeCode(params.employeeCode);
  if (existing) {
    throw new ApiError(409, "EMPLOYEE_CODE_TAKEN", `Employee code ${params.employeeCode} already exists.`);
  }
  const passwordHash = await bcrypt.hash(params.temporaryPassword, 12);
  return employeeRepo.createEmployee({
    companyId: params.companyId,
    distributorId: params.distributorId,
    employeeCode: params.employeeCode,
    name: params.name,
    phone: params.phone,
    passwordHash,
  });
}

export function toPublicEmployee(row: employeeRepo.EmployeeRow) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    name: row.name,
    phone: row.phone,
    role: row.role,
  };
}
