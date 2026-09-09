// Admin employee-provisioning CLI script. Kept alongside the new
// POST /api/v1/admin/employees HTTP endpoint (see DECISIONS.md
// 2026-09-09) — both call employeeService.provisionEmployee, so this is
// just an alternate entry point (useful for scripted/offline provisioning,
// e.g. seeding a batch of employees from a shell script) rather than the
// only way in, as it was in the MVP.
//
// Usage:
//   npm run create-employee -- --code=ASM001 --name="Suresh Patel" --phone=9876500002 --role=ASM [--manager=SM001] [--company=FLOWMINT-CO]

import "dotenv/config";
import crypto from "node:crypto";
import { pool } from "../src/db/pool";
import { provisionEmployee } from "../src/modules/employees/employeeService";
import * as employeeRepo from "../src/modules/employees/employeeRepository";
import type { EmployeeRole } from "@flowmint/shared";

const VALID_ROLES: EmployeeRole[] = ["SALES_OFFICER", "ISR", "ASE", "ASM", "RSM", "COUNTRY_HEAD", "ADMIN"];

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-zA-Z0-9-]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const employeeCode = args.code;
  const name = args.name;
  const phone = args.phone;
  const role = (args.role ?? "SALES_OFFICER") as EmployeeRole;
  const managerCode = args.manager;
  const companyCode = args.company ?? "FLOWMINT-CO";

  if (!employeeCode || !name || !phone) {
    console.error(
      'Usage: npm run create-employee -- --code=ASM001 --name="Suresh Patel" --phone=9876500002 --role=ASM [--manager=SM001]'
    );
    process.exit(1);
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    console.error("Phone must be a 10-digit Indian mobile number (e.g. 9876500002).");
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`Role must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const { rows: companyRows } = await pool.query(`SELECT id FROM companies WHERE code = $1`, [companyCode]);
  if (companyRows.length === 0) {
    console.error(`Company with code ${companyCode} not found. Run the seed script first, or pass --company=<code>.`);
    process.exit(1);
  }
  const companyId = companyRows[0].id;

  let reportingManagerId: string | undefined;
  if (managerCode) {
    const manager = await employeeRepo.findByEmployeeCode(managerCode);
    if (!manager) {
      console.error(`Manager with employee_code ${managerCode} not found.`);
      process.exit(1);
    }
    reportingManagerId = manager.id;
  }

  const temporaryPassword = generateTempPassword();

  const employee = await provisionEmployee({
    companyId,
    employeeCode,
    name,
    phone,
    role,
    reportingManagerId,
    temporaryPassword,
  });

  console.log("Employee created:");
  console.log(`  employee_code: ${employee.employee_code}`);
  console.log(`  name:          ${employee.name}`);
  console.log(`  phone:         ${employee.phone}`);
  console.log(`  role:          ${employee.role}`);
  console.log(`  temp password: ${temporaryPassword}`);
  console.log("");
  console.log("This password is shown once and is not recoverable. Hand it to the");
  console.log("employee directly, or have them use forgot-password on first login.");

  await pool.end();
}

main().catch((err) => {
  console.error("create-employee failed:", err);
  process.exit(1);
});
