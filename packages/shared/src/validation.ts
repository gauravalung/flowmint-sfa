// Shared zod validation schemas — used server-side for request validation
// and can be reused client-side for form validation so both sides agree
// on what "valid" means without duplicating the rules.
import { z } from "zod";

export const employeeCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_-]+$/, "Employee code may only contain letters, numbers, - and _");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72); // bcrypt's effective input limit

export const indianPhoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number");

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "OTP must be 6 digits");

export const loginRequestSchema = z.object({
  employeeCode: employeeCodeSchema,
  password: z.string().min(1),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordRequestSchema = z.object({
  employeeCode: employeeCodeSchema,
});

export const forgotPasswordVerifySchema = z.object({
  employeeCode: employeeCodeSchema,
  otp: otpCodeSchema,
});

export const forgotPasswordResetSchema = z.object({
  resetToken: z.string().min(1),
  newPassword: passwordSchema,
});

export const retailerOtpRequestSchema = z.object({
  phone: indianPhoneSchema,
});

export const retailerOtpVerifySchema = z.object({
  phone: indianPhoneSchema,
  otp: otpCodeSchema,
});

export const createRetailerSchema = z.object({
  verificationToken: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().max(120).optional(),
  addressLine: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional(),
  phone: indianPhoneSchema,
});

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(9999),
});

export const createOrderSchema = z.object({
  clientUuid: z.string().uuid(),
  retailerId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  items: z.array(cartLineSchema).min(1).max(200),
});

export const startVisitSchema = z.object({
  clientUuid: z.string().uuid(),
  retailerId: z.string().uuid(),
  beatId: z.string().uuid().optional(),
  isOffBeat: z.boolean().optional().default(false),
});

export const closeVisitSchema = z.object({
  outcome: z.enum(["ORDER_BOOKED", "NO_ORDER"]),
  noOrderReason: z
    .enum(["SHOP_CLOSED", "OWNER_ABSENT", "SUFFICIENT_STOCK", "CREDIT_ISSUE", "PRICE_ISSUE", "OTHER"])
    .optional(),
});
