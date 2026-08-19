import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import {
  retailerOtpRequestSchema,
  retailerOtpVerifySchema,
  createRetailerSchema,
} from "@flowmint/shared";
import * as retailerService from "./retailerService";

export async function getRetailerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await retailerService.getRetailerDetail(req.employee.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function searchRetailersHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const result = await retailerService.searchRetailers(req.employee.id, search, page, pageSize);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

const GENERIC_OTP_REQUEST_MESSAGE = "An OTP has been sent to this phone number.";

export async function requestOutletOtpHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = retailerOtpRequestSchema.parse(req.body);
    await retailerService.requestOutletOtp(body.phone);
    res.json({ message: GENERIC_OTP_REQUEST_MESSAGE });
  } catch (err) {
    next(err);
  }
}

export async function verifyOutletOtpHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = retailerOtpVerifySchema.parse(req.body);
    const verificationToken = await retailerService.verifyOutletOtp(body.phone, body.otp);
    res.json({ verificationToken });
  } catch (err) {
    next(err);
  }
}

export async function createRetailerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = createRetailerSchema.parse(req.body);
    const result = await retailerService.createFieldRetailer(req.employee.id, body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
