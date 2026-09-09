// Shared zod validation schemas — used server-side for request validation
// and reusable client-side so both sides agree on what "valid" means
// without duplicating the rules.
//
// Phase 1 — see claude/Flowmint_Phase1_Scope_Locked.md. Auth/OTP-token
// schemas are carried over unchanged from the MVP; retailer/order schemas
// are extended for the new fields; org-hierarchy/mapping/bulk-upload
// schemas are new.
import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives (unchanged from the MVP)
// ---------------------------------------------------------------------------

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

export const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, - and _");

// ---------------------------------------------------------------------------
// Auth (unchanged from the MVP)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Retailer OTP (outlet creation — unchanged mechanics from the MVP)
// ---------------------------------------------------------------------------

export const retailerOtpRequestSchema = z.object({
  phone: indianPhoneSchema,
});

export const retailerOtpVerifySchema = z.object({
  phone: indianPhoneSchema,
  otp: otpCodeSchema,
});

// Field ("Add New Outlet") creation, spec §8.5 — beat is pre-filled from
// context, category/subcategory now required by the retailer classification
// rule (spec §5). verificationToken is required unless OTP has been made
// optional system-wide (system_settings.otp_mandatory_for_outlet_creation);
// that toggle is enforced server-side, not by this schema.
export const retailerCategorySchema = z.enum(["RETAIL", "WHOLESALE"]);

export const createFieldRetailerSchema = z.object({
  beatId: z.string().uuid(),
  verificationToken: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().max(120).optional(),
  category: retailerCategorySchema,
  subcategoryId: z.string().uuid().optional(),
  addressLine: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional(),
  phone: indianPhoneSchema,
});

// Admin-side retailer creation (single or as the row schema behind bulk
// upload) — code is optional; blank means system-assigned (spec §3).
export const createRetailerAdminSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().max(120).optional(),
  category: retailerCategorySchema,
  subcategoryId: z.string().uuid().optional(),
  addressLine: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional(),
  phone: indianPhoneSchema.optional(),
});

export const retailerStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

export const retailerSubcategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

// ---------------------------------------------------------------------------
// Distribution partners (Super/Direct/Sub Distributor — spec §2.1)
// ---------------------------------------------------------------------------

export const distributionPartnerTypeSchema = z.enum([
  "SUPER_DISTRIBUTOR",
  "DIRECT_DISTRIBUTOR",
  "SUB_DISTRIBUTOR",
]);

export const createDistributionPartnerSchema = z
  .object({
    partnerType: distributionPartnerTypeSchema,
    // Required for SUPER_DISTRIBUTOR/DIRECT_DISTRIBUTOR (admin-assigned);
    // forbidden for SUB_DISTRIBUTOR (system-generated) — enforced in the
    // service, since it depends on partnerType.
    code: codeSchema.optional(),
    parentPartnerId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120),
    contactName: z.string().trim().max(120).optional(),
    contactPhone: indianPhoneSchema.optional(),
    addressLine: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .refine((data) => data.partnerType !== "SUB_DISTRIBUTOR" || !!data.parentPartnerId, {
    message: "parentPartnerId is required for a Sub Distributor",
    path: ["parentPartnerId"],
  })
  .refine((data) => data.partnerType === "SUB_DISTRIBUTOR" || !!data.code, {
    message: "code is required for Super/Direct Distributors",
    path: ["code"],
  });

export const distributionPartnerStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

export const createBeatSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(2).max(120),
});

// ---------------------------------------------------------------------------
// Mappings (spec §6) — one small schema per relationship, since the field
// names differ; every mapping create is just "the two ids," every removal
// is just "the mapping id."
// ---------------------------------------------------------------------------

export const distributionPartnerBeatMappingSchema = z.object({
  distributionPartnerId: z.string().uuid(),
  beatId: z.string().uuid(),
});

export const beatRetailerMappingSchema = z.object({
  beatId: z.string().uuid(),
  retailerId: z.string().uuid(),
  sequenceNo: z.number().int().positive().optional(),
});

export const retailerDistributionPartnerMappingSchema = z.object({
  retailerId: z.string().uuid(),
  distributionPartnerId: z.string().uuid(),
});

export const employeeDistributionPartnerMappingSchema = z.object({
  employeeId: z.string().uuid(),
  distributionPartnerId: z.string().uuid(),
});

export const employeeBeatMappingSchema = z.object({
  employeeId: z.string().uuid(),
  beatId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
});

export const employeeRetailerMappingSchema = z.object({
  employeeId: z.string().uuid(),
  retailerId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Employees (admin provisioning — extends the MVP's CLI-only schema with
// role + reporting manager)
// ---------------------------------------------------------------------------

export const employeeRoleSchema = z.enum([
  "SALES_OFFICER",
  "ISR",
  "ASE",
  "ASM",
  "RSM",
  "COUNTRY_HEAD",
  "ADMIN",
]);

export const createEmployeeSchema = z.object({
  employeeCode: employeeCodeSchema,
  name: z.string().trim().min(2).max(120),
  phone: indianPhoneSchema,
  role: employeeRoleSchema,
  reportingManagerId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Catalog / orders
// ---------------------------------------------------------------------------

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(9999),
});

export const createOrderSchema = z.object({
  clientUuid: z.string().uuid(),
  retailerId: z.string().uuid(),
  distributionPartnerId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  items: z.array(cartLineSchema).min(1).max(200),
});

export const deliverOrderItemSchema = z.object({
  orderItemId: z.string().uuid(),
  deliveredQuantity: z.number().int().min(0).max(9999),
});

// items omitted/empty => every line delivered exactly as booked.
export const deliverOrderSchema = z.object({
  items: z.array(deliverOrderItemSchema).max(200).optional(),
});

export const startVisitSchema = z.object({
  clientUuid: z.string().uuid(),
  retailerId: z.string().uuid(),
  beatId: z.string().uuid().optional(),
  isOffBeat: z.boolean().optional().default(false),
});

export const closeVisitSchema = z
  .object({
    outcome: z.enum(["ORDER_BOOKED", "NO_ORDER"]),
    noOrderReason: z
      .enum(["SHOP_CLOSED", "OWNER_ABSENT", "SUFFICIENT_STOCK", "CREDIT_ISSUE", "PRICE_ISSUE", "OTHER"])
      .optional(),
  })
  .refine((data) => data.outcome !== "NO_ORDER" || !!data.noOrderReason, {
    message: "noOrderReason is required when outcome is NO_ORDER",
    path: ["noOrderReason"],
  });

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------

export const updateSystemSettingSchema = z.object({
  value: z.unknown(),
});

// ---------------------------------------------------------------------------
// Products / distributor inventory
// ---------------------------------------------------------------------------

export const createProductAdminSchema = z.object({
  skuCode: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  brandName: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  packSize: z.string().trim().min(1),
  uom: z.string().trim().optional(),
  mrp: z.number().positive(),
  price: z.number().positive(),
  gstRate: z.number().min(0).max(100),
});

export const setDistributorInventorySchema = z.object({
  productId: z.string().uuid(),
  availableQty: z.number().int().min(0),
  isFocusProduct: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Bulk upload row schemas (spec §11) — one per upload type. These validate
// a single already-parsed CSV row (string values); numeric/boolean coercion
// happens here so the same schema works for both the parse step and any
// programmatic caller.
// ---------------------------------------------------------------------------

export const bulkUploadTypeSchema = z.enum(["RETAILER", "PRODUCT", "BEAT_RETAILER_MAPPING", "EMPLOYEE"]);

export const bulkRetailerRowSchema = z.object({
  code: z.string().trim().optional(),
  name: z.string().trim().min(2, "name is required"),
  ownerName: z.string().trim().optional(),
  category: retailerCategorySchema,
  subcategoryName: z.string().trim().optional(),
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

export const bulkProductRowSchema = z.object({
  skuCode: z.string().trim().min(1, "skuCode is required"),
  name: z.string().trim().min(1, "name is required"),
  brandName: z.string().trim().min(1, "brandName is required"),
  categoryName: z.string().trim().min(1, "categoryName is required"),
  packSize: z.string().trim().min(1, "packSize is required"),
  uom: z.string().trim().optional(),
  mrp: z.coerce.number().positive("mrp must be a positive number"),
  price: z.coerce.number().positive("price must be a positive number"),
  gstRate: z.coerce.number().min(0).max(100, "gstRate must be between 0 and 100"),
});

export const bulkBeatRetailerMappingRowSchema = z.object({
  beatCode: z.string().trim().min(1, "beatCode is required"),
  retailerCode: z.string().trim().min(1, "retailerCode is required"),
  sequenceNo: z.coerce.number().int().positive().optional(),
});

export const bulkEmployeeRowSchema = z.object({
  employeeCode: employeeCodeSchema,
  name: z.string().trim().min(2, "name is required"),
  phone: indianPhoneSchema,
  role: employeeRoleSchema,
  reportingManagerCode: z.string().trim().optional(),
});
