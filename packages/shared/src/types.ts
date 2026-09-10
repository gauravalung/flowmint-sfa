// Shared domain types used by both apps/api and apps/mobile (and, once
// built, apps/admin). Hand-written, not generated — if this drifts from the
// DB schema, the DB schema (apps/api/db/migrations) wins.
//
// Phase 1 — see claude/Flowmint_Phase1_Scope_Locked.md. Supersedes the MVP
// shapes in the areas the new requirements doc redefines (roles, retailer
// shape, orders/scheme); the auth/OTP/token shapes are carried over as-is.

export type EmployeeRole =
  | "SALES_OFFICER"
  | "ISR"
  | "ASE"
  | "ASM"
  | "RSM"
  | "COUNTRY_HEAD"
  | "ADMIN";

export interface EmployeePublic {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  role: EmployeeRole;
  reportingManagerId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  employee: EmployeePublic;
}

// ---------------------------------------------------------------------------
// Distribution hierarchy
// ---------------------------------------------------------------------------

export type DistributionPartnerType = "SUPER_DISTRIBUTOR" | "DIRECT_DISTRIBUTOR" | "SUB_DISTRIBUTOR";

export interface DistributionPartnerSummary {
  id: string;
  partnerType: DistributionPartnerType;
  parentPartnerId: string | null;
  code: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  /** Derived, not stored — see spec §2.1. Company for Super/Direct, the parent's id for Sub. */
  billedBy: "COMPANY" | string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Retailers
// ---------------------------------------------------------------------------

export type RetailerCategory = "RETAIL" | "WHOLESALE";
export type RetailerSource = "SEED" | "ADMIN" | "FIELD" | "BULK";

export interface RetailerSubcategory {
  id: string;
  name: string;
  isActive: boolean;
}

export interface RetailerSummary {
  id: string;
  code: string;
  name: string;
  ownerName: string | null;
  category: RetailerCategory;
  subcategoryId: string | null;
  subcategoryName: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  latitude: string | null;
  longitude: string | null;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

export interface BeatSummary {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Mappings — one shape covers all six relationship tables (spec §6); which
// table it's read from/written to is determined by the endpoint, not the
// payload shape.
// ---------------------------------------------------------------------------

export type MappingKind =
  | "DISTRIBUTION_PARTNER_BEAT"
  | "BEAT_RETAILER"
  | "RETAILER_DISTRIBUTION_PARTNER"
  | "EMPLOYEE_DISTRIBUTION_PARTNER"
  | "EMPLOYEE_BEAT"
  | "EMPLOYEE_RETAILER";

export interface MappingSummary {
  id: string;
  isActive: boolean;
  deactivatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Status tracking (spec §4)
// ---------------------------------------------------------------------------

export type StatusEntityType = "DISTRIBUTION_PARTNER" | "RETAILER";

export interface StatusChangeLogEntry {
  id: string;
  entityType: StatusEntityType;
  entityId: string;
  previousStatus: boolean;
  newStatus: boolean;
  changedAt: string;
  changedByEmployeeId: string | null;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// PJP (spec §8.2)
// ---------------------------------------------------------------------------

export type PjpStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUPERSEDED";

export interface PjpEntry {
  id: string;
  employeeId: string;
  planDate: string;
  beatId: string | null;
  isWeeklyOff: boolean;
  status: PjpStatus;
  submittedAt: string;
  reviewedByEmployeeId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  supersedesPjpEntryId: string | null;
}

// ---------------------------------------------------------------------------
// GPS-verified working-hours day start (spec §8.3)
// ---------------------------------------------------------------------------

export interface WorkDaySession {
  id: string;
  employeeId: string;
  workDate: string;
  startedAt: string;
  startLatitude: string;
  startLongitude: string;
  verifiedRetailerId: string | null;
  endedAt: string | null;
}

// ---------------------------------------------------------------------------
// Beat visits (unchanged shape from the MVP)
// ---------------------------------------------------------------------------

export type VisitOutcome = "IN_PROGRESS" | "ORDER_BOOKED" | "NO_ORDER";

export type NoOrderReason =
  | "SHOP_CLOSED"
  | "OWNER_ABSENT"
  | "SUFFICIENT_STOCK"
  | "CREDIT_ISSUE"
  | "PRICE_ISSUE"
  | "OTHER";

export interface BeatRetailerEntry extends RetailerSummary {
  sequenceNo: number;
  visitStatus: VisitOutcome | "PENDING";
  visitId: string | null;
}

export interface TodayBeatResponse {
  beatId: string | null;
  beatName: string | null;
  date: string; // YYYY-MM-DD
  retailers: BeatRetailerEntry[];
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface ProductSummary {
  id: string;
  skuCode: string;
  name: string;
  brandName: string;
  categoryName: string;
  categoryId: string;
  packSize: string;
  uom: string;
  mrp: string;
  price: string;
  gstRate: string;
  /** Present only when fetched through a distributor's inventory (§8.6). */
  availableQty?: number;
  isFocusProduct?: boolean;
}

// ---------------------------------------------------------------------------
// Orders — scheme v2 (spec §9)
// ---------------------------------------------------------------------------

export interface CartLineInput {
  productId: string;
  quantity: number;
}

export interface OrderLineResult {
  productId: string;
  skuCodeSnapshot: string;
  productNameSnapshot: string;
  packSizeSnapshot: string;
  uomSnapshot: string;
  unitPrice: string;
  quantity: number;
  deliveredQuantity: number | null;
  lineAmount: string;
  gstRateSnapshot: string;
  tentativeLineDiscountAmount: string;
  tentativeLineGstAmount: string;
  tentativeLineTotal: string;
  finalLineDiscountAmount: string | null;
  finalLineGstAmount: string | null;
  finalLineTotal: string | null;
}

export type OrderStatus = "SUBMITTED" | "SAVED" | "CANCELLED" | "DELIVERED";

export interface OrderResult {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderDate: string;
  retailerId: string;
  distributionPartnerId: string;
  subtotalAmount: string;
  tentativeDiscountPct: string;
  tentativeDiscountAmount: string;
  tentativeTaxableAmount: string;
  tentativeGstAmount: string;
  tentativeGrandTotalAmount: string;
  deliveredSubtotalAmount: string | null;
  finalDiscountPct: string | null;
  finalDiscountAmount: string | null;
  finalTaxableAmount: string | null;
  finalGstAmount: string | null;
  finalGrandTotalAmount: string | null;
  items: OrderLineResult[];
}

// ---------------------------------------------------------------------------
// Bulk upload (spec §11)
// ---------------------------------------------------------------------------

export type BulkUploadType = "RETAILER" | "PRODUCT" | "BEAT_RETAILER_MAPPING" | "EMPLOYEE";

export interface BulkUploadRowError {
  row: number;
  message: string;
}

export interface BulkUploadResult {
  jobId: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: BulkUploadRowError[];
}

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------

export interface SystemSetting<T = unknown> {
  key: string;
  value: T;
  updatedAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
