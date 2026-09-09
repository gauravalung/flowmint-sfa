import crypto from "node:crypto";
import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { createEmployeeSchema } from "@flowmint/shared";
import * as employeeService from "./employeeService";

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

// Admin-only employee provisioning over HTTP — see employeeService.ts for
// why this is now exposed (it wasn't in the MVP; see DECISIONS.md
// 2026-08-18 round 4 vs. 2026-09-09). Returns the generated temporary
// password once, same as the CLI script — it is not recoverable afterwards.
export async function createHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = createEmployeeSchema.parse(req.body);
    const temporaryPassword = generateTempPassword();
    const employee = await employeeService.provisionEmployee({
      companyId: req.employee.companyId,
      employeeCode: body.employeeCode,
      name: body.name,
      phone: body.phone,
      role: body.role,
      reportingManagerId: body.reportingManagerId,
      temporaryPassword,
    });
    res.status(201).json({
      ...employeeService.toPublicEmployee(employee),
      temporaryPassword,
    });
  } catch (err) {
    next(err);
  }
}
