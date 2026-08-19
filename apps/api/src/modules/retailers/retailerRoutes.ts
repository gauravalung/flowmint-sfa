import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../middleware/requireAuth";
import {
  getRetailerHandler,
  searchRetailersHandler,
  requestOutletOtpHandler,
  verifyOutletOtpHandler,
  createRetailerHandler,
} from "./retailerController";

const router = Router();

function rateLimitHandler(_req: Request, res: Response) {
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." },
  });
}

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

router.get("/", requireAuth, searchRetailersHandler as any);
router.post("/otp/request", requireAuth, otpLimiter, requestOutletOtpHandler as any);
router.post("/otp/verify", requireAuth, otpLimiter, verifyOutletOtpHandler as any);
router.post("/", requireAuth, createRetailerHandler as any);
router.get("/:id", requireAuth, getRetailerHandler as any);

export default router;
