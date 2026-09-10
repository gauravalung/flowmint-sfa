import { ApiError } from "../../lib/errors";
import * as distributorRepo from "./distributorRepository";
import * as employeeRepo from "../employees/employeeRepository";
import type { DistributorSummary } from "@flowmint/shared";

export async function listDistributors(employeeId: string): Promise<DistributorSummary[]> {
  const rows = await distributorRepo.findForEmployee(employeeId);
  return rows.map((d) => ({ id: d.id, name: d.name, code: d.code }));
}

// The single access check every distributor-scoped module (retailers,
// visits, orders, beats) calls before touching anything: does this
// employee's employee_distributor_mapping actually include this
// distributor? Same "not found" wording for both "distributor doesn't
// exist" and "not mapped to this employee" — no need to distinguish those
// for a salesman who was never going to have either.
export async function requireDistributorAccess(
  employeeId: string,
  distributorId: string
): Promise<{ companyId: string; distributorId: string }> {
  const employee = await employeeRepo.findById(employeeId);
  if (!employee) {
    throw new ApiError(404, "DISTRIBUTOR_NOT_FOUND", "Distributor not found.");
  }
  const hasAccess = await distributorRepo.hasAccess(employeeId, distributorId);
  if (!hasAccess) {
    throw new ApiError(404, "DISTRIBUTOR_NOT_FOUND", "Distributor not found.");
  }
  return { companyId: employee.company_id, distributorId };
}
