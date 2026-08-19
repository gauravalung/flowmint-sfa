import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import {
  loginHandler,
  refreshHandler,
  forgotPasswordRequestHandler,
  forgotPasswordVerifyHandler,
  forgotPasswordResetHandler,
} from "./authController";

const router = Router();

// Keep rate-limit responses in the same {error:{code,message}} envelope as
// everything else — express-rate-limit's default handler sends plain text,
// which would otherwise be the one inconsistent response shape in the API.
function rateLimitHandler(_req: Request, res: Response) {
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." },
  });
}

// Rate limiting is a secondary defense here — the primary defense against
// credential-guessing is the per-account lockout in authService.login.
// This IP-based limit exists to slow down guessing spread across many
// different employee codes from one source.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

router.post("/login", loginLimiter, loginHandler);
router.post("/refresh", refreshHandler);
router.post("/forgot-password/request", otpLimiter, forgotPasswordRequestHandler);
router.post("/forgot-password/verify", otpLimiter, forgotPasswordVerifyHandler);
router.post("/forgot-password/reset", forgotPasswordResetHandler);

export default router;
