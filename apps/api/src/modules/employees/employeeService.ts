import bcrypt from "bcryptjs";
import * as employeeRepo from "./employeeRepository";
import { ApiError } from "../../lib/errors";
import type { EmployeeRole } from "@flowmint/shared";

/**
 * Provisions a new employee login (any role, including ADMIN). Called from
 * both the create-employee CLI script and the admin HTTP endpoint
 * (POST /api/v1/admin/employees, requireRole("ADMIN")) — both share this
 * exact function, so the interface split is at the service boundary, not
 * duplicated logic.
 *
 * Unlike the MVP (see DECISIONS.md 2026-08-18 round 4), Phase 1 does expose
 * this over HTTP: the "CLI-only, no network-reachable path" tradeoff was
 * justified specifically by single-pilot-salesman scale, which no longer
 * holds now that Phase 1 includes an admin web portal and a bulk employee
 * upload feature covering a real multi-employee rollout. The endpoint is
 * admin-role-gated and rate-limited rather than wide open.
 */
export async function provisionEmployee(params: {
  companyId: string;
  employeeCode: string;
  name: string;
  phone: string;
  role: EmployeeRole;
  reportingManagerId?: string | null;
  temporaryPassword: string;
}) {
  const existing = await employeeRepo.findByEmployeeCode(params.employeeCode);
  if (existing) {
    throw new ApiError(409, "EMPLOYEE_CODE_TAKEN", `Employee code ${params.employeeCode} already exists.`);
  }

  if (params.reportingManagerId) {
    const manager = await employeeRepo.findById(params.reportingManagerId);
    if (!manager || !manager.is_active) {
      throw new ApiError(400, "REPORTING_MANAGER_NOT_FOUND", "reportingManagerId does not refer to an active employee.");
    }
  }

  const passwordHash = await bcrypt.hash(params.temporaryPassword, 12);
  return employeeRepo.createEmployee({
    companyId: params.companyId,
    employeeCode: params.employeeCode,
    name: params.name,
    phone: params.phone,
    role: params.role,
    reportingManagerId: params.reportingManagerId ?? null,
    passwordHash,
  });
}

export async function listEmployees(filter: { isActive?: boolean; role?: EmployeeRole }) {
  const rows = await employeeRepo.list(filter);
  return rows.map(toPublicEmployee);
}

export function toPublicEmployee(row: employeeRepo.EmployeeRow) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    name: row.name,
    phone: row.phone,
    role: row.role,
    reportingManagerId: row.reporting_manager_id,
  };
}
