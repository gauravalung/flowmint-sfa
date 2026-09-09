import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { createHandler, listHandler } from "./adminEmployeeController";

const router = Router();

function rateLimitHandler(_req: Request, res: Response) {
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." },
  });
}

// Account-creation endpoint — rate-limited even for an authenticated admin,
// same defense-in-depth posture as auth/otp endpoints elsewhere in the API.
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

router.get("/", requireAuth, requireRole("ADMIN"), listHandler as any);
router.post("/", requireAuth, requireRole("ADMIN"), createLimiter, createHandler as any);

export default router;
