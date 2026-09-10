import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import type { EmployeeRole } from "@flowmint/shared";
import { ApiError } from "../lib/errors";

// Must run after requireAuth (needs req.employee). Typed as a plain
// Express RequestHandler (not AuthenticatedRequest) so it composes with
// router.use(requireAuth, requireRole(...)) without a cast at every call
// site — the cast happens once, here, since requireAuth is guaranteed to
// have already run and attached req.employee.
//
// Admin endpoints — org hierarchy, mappings, bulk upload, status changes —
// are all gated by this; see claude/Flowmint_Phase1_Scope_Locked.md §11
// ("Admin owns all mapping creation/removal").
export function requireRole(...allowedRoles: EmployeeRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { employee } = req as AuthenticatedRequest;
    if (!allowedRoles.includes(employee.role as EmployeeRole)) {
      return next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action."));
    }
    next();
  };
}
