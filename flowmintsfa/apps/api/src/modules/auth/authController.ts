import { Request, Response, NextFunction } from "express";
import {
  loginRequestSchema,
  refreshRequestSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  forgotPasswordResetSchema,
} from "@flowmint/shared";
import * as authService from "./authService";

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginRequestSchema.parse(req.body);
    const result = await authService.login(body.employeeCode, body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = refreshRequestSchema.parse(req.body);
    const result = await authService.refresh(body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

const GENERIC_RESET_REQUEST_MESSAGE =
  "If that employee code exists, an OTP has been sent to the registered phone number.";

export async function forgotPasswordRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = forgotPasswordRequestSchema.parse(req.body);
    await authService.requestPasswordReset(body.employeeCode);
    // Always the same response — see authService.requestPasswordReset.
    res.json({ message: GENERIC_RESET_REQUEST_MESSAGE });
  } catch (err) {
    next(err);
  }
}

export async function forgotPasswordVerifyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = forgotPasswordVerifySchema.parse(req.body);
    const resetToken = await authService.verifyPasswordResetOtp(body.employeeCode, body.otp);
    res.json({ resetToken });
  } catch (err) {
    next(err);
  }
}

export async function forgotPasswordResetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = forgotPasswordResetSchema.parse(req.body);
    await authService.resetPassword(body.resetToken, body.newPassword);
    res.json({ message: "Password updated. Please log in again." });
  } catch (err) {
    next(err);
  }
}
