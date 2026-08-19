import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { ApiError } from "../lib/errors";

export interface AuthenticatedRequest extends Request {
  employee: {
    id: string;
    employeeCode: string;
    role: string;
  };
}

// All Slice B+ endpoints act on behalf of the logged-in salesman — every
// query below is scoped by req.employee.id (or their distributor), never by
// an id passed from the client. That's what keeps one salesman from ever
// reading or writing another's data even though there's only one role today.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(401, "AUTH_REQUIRED", "Missing or invalid Authorization header."));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).employee = {
      id: payload.sub,
      employeeCode: payload.employeeCode,
      role: payload.role,
    };
    next();
  } catch {
    next(new ApiError(401, "AUTH_INVALID_TOKEN", "Invalid or expired access token."));
  }
}
