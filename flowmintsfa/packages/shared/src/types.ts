// Shared domain types used by both apps/api and apps/mobile.
// Keep these in sync with prisma/schema.prisma in apps/api — this file
// is hand-written (not generated) for the MVP; if it drifts from the DB
// schema, the DB schema wins.

export type EmployeeRole = "SALESMAN";

export interface EmployeePublic {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  role: EmployeeRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  employee: EmployeePublic;
}

export type VisitOutcome = "IN_PROGRESS" | "ORDER_BOOKED" | "NO_ORDER";

export type NoOrderReason =
  | "SHOP_CLOSED"
  | "OWNER_ABSENT"
  | "SUFFICIENT_STOCK"
  | "CREDIT_ISSUE"
  | "PRICE_ISSUE"
  | "OTHER";

export interface RetailerSummary {
  id: string;
  code: string;
  name: string;
  ownerName: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
}

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
}

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
  lineAmount: string;
  lineDiscountAmount: string;
  gstRateSnapshot: string;
  lineGstAmount: string;
  lineTotal: string;
}

export interface OrderResult {
  id: string;
  orderNumber: string;
  status: "SUBMITTED" | "CANCELLED";
  orderDate: string;
  retailerId: string;
  subtotalAmount: string;
  discountPct: string;
  discountAmount: string;
  taxableAmount: string;
  gstAmount: string;
  grandTotalAmount: string;
  items: OrderLineResult[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
