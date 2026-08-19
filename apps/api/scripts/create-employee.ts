// Admin employee-provisioning CLI script.
// No HTTP endpoint exists for this on purpose — see DECISIONS.md
// 2026-08-18 (round 4). Run from a machine with DATABASE_URL access.
//
// Usage:
//   npm run create-employee -- --code=SM002 --name="Suresh Patel" --phone=9876500002 [--company=FLOWMINT-CO] [--distributor=FLOWMINT-DIST]
//
// Prints a generated temporary password once — it is not stored anywhere
// in plaintext and cannot be retrieved again. The employee should use
// forgot-password on first login if you don't hand it to them directly.

import "dotenv/config";
import crypto from "node:crypto";
import { pool } from "../src/db/pool";
import { provisionEmployee } from "../src/modules/employees/employeeService";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-zA-Z0-9-]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function generateTempPassword(): string {
  // 12 random bytes -> base64url, trimmed to a typeable length. Not meant
  // to be memorized long-term — the employee should change it via
  // forgot-password shortly after first login.
  return crypto.randomBytes(9).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const employeeCode = args.code;
  const name = args.name;
  const phone = args.phone;
  const companyCode = args.company ?? "FLOWMINT-CO";
  const distributorCode = args.distributor ?? "FLOWMINT-DIST";

  if (!employeeCode || !name || !phone) {
    console.error("Usage: npm run create-employee -- --code=SM002 --name=\"Suresh Patel\" --phone=9876500002");
    process.exit(1);
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    console.error("Phone must be a 10-digit Indian mobile number (e.g. 9876500002).");
    process.exit(1);
  }

  const { rows: companyRows } = await pool.query(`SELECT id FROM companies WHERE code = $1`, [companyCode]);
  if (companyRows.length === 0) {
    console.error(`Company with code ${companyCode} not found. Run the seed script first, or pass --company=<code>.`);
    process.exit(1);
  }
  const companyId = companyRows[0].id;

  const { rows: distributorRows } = await pool.query(`SELECT id FROM distributors WHERE code = $1`, [distributorCode]);
  const distributorId = distributorRows[0]?.id ?? null;

  const temporaryPassword = generateTempPassword();

  const employee = await provisionEmployee({
    companyId,
    distributorId,
    employeeCode,
    name,
    phone,
    temporaryPassword,
  });

  console.log("Employee created:");
  console.log(`  employee_code: ${employee.employee_code}`);
  console.log(`  name:          ${employee.name}`);
  console.log(`  phone:         ${employee.phone}`);
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
