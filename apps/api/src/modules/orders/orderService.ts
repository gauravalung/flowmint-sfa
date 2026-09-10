import { ApiError } from "../../lib/errors";
import { calculateSchemeBreakdown } from "@flowmint/shared";
import * as orderRepo from "./orderRepository";
import * as productRepo from "../products/productRepository";
import * as retailerRepo from "../retailers/retailerRepository";
import { pool } from "../../db/pool";
import { istDateString } from "../../lib/istDate";
import type { OrderResult, CartLineInput } from "@flowmint/shared";

// Note on inventory: distribution_partner_product_inventory.available_qty is
// used as a catalog FILTER ("Available Quantity" per spec §8.6) and as the
// admin-managed stock figure — it is intentionally NOT auto-decremented by
// order submission/cancellation in this slice. Real-world fulfillment
// shortfalls are handled by the delivered_quantity mechanic at delivery
// (§9), which is the actual point where "what was really supplied" matters.
// Auto-decrementing at booking (and restoring on cancel) is a reasonable
// enhancement but adds real complexity (races, partial restores) that isn't
// needed for Phase 1 basic scope — flagged here rather than half-built.

async function requireEmployeeMappedToDistributor(employeeId: string, distributionPartnerId: string) {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM employee_distribution_partner_mapping
       WHERE employee_id = $1 AND distribution_partner_id = $2 AND is_active = true
     ) AS exists`,
    [employeeId, distributionPartnerId]
  );
  if (!rows[0]?.exists) {
    throw new ApiError(403, "DISTRIBUTOR_NOT_MAPPED", "You are not mapped to this distributor.");
  }
}

function toResult(order: orderRepo.SalesOrderRow, items: orderRepo.SalesOrderItemRow[]): OrderResult {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    orderDate: order.order_date,
    retailerId: order.retailer_id,
    distributionPartnerId: order.distribution_partner_id,
    subtotalAmount: order.subtotal_amount,
    tentativeDiscountPct: order.tentative_discount_pct,
    tentativeDiscountAmount: order.tentative_discount_amount,
    tentativeTaxableAmount: order.tentative_taxable_amount,
    tentativeGstAmount: order.tentative_gst_amount,
    tentativeGrandTotalAmount: order.tentative_grand_total_amount,
    deliveredSubtotalAmount: order.delivered_subtotal_amount,
    finalDiscountPct: order.final_discount_pct,
    finalDiscountAmount: order.final_discount_amount,
    finalTaxableAmount: order.final_taxable_amount,
    finalGstAmount: order.final_gst_amount,
    finalGrandTotalAmount: order.final_grand_total_amount,
    items: items.map((i) => ({
      productId: i.product_id,
      skuCodeSnapshot: i.sku_code_snapshot,
      productNameSnapshot: i.product_name_snapshot,
      packSizeSnapshot: i.pack_size_snapshot,
      uomSnapshot: i.uom_snapshot,
      unitPrice: i.unit_price,
      quantity: i.quantity,
      deliveredQuantity: i.delivered_quantity,
      lineAmount: i.line_amount,
      gstRateSnapshot: i.gst_rate_snapshot,
      tentativeLineDiscountAmount: i.tentative_line_discount_amount,
      tentativeLineGstAmount: i.tentative_line_gst_amount,
      tentativeLineTotal: i.tentative_line_total,
      finalLineDiscountAmount: i.final_line_discount_amount,
      finalLineGstAmount: i.final_line_gst_amount,
      finalLineTotal: i.final_line_total,
    })),
  };
}

export async function createOrder(
  employeeId: string,
  companyId: string,
  params: {
    clientUuid: string;
    retailerId: string;
    distributionPartnerId: string;
    visitId?: string;
    items: CartLineInput[];
  }
): Promise<OrderResult> {
  await requireEmployeeMappedToDistributor(employeeId, params.distributionPartnerId);

  const retailer = await retailerRepo.findById(params.retailerId);
  if (!retailer || !retailer.is_active) {
    throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found.");
  }
  const accessible = await retailerRepo.isRetailerAccessibleToEmployee(employeeId, params.retailerId);
  if (!accessible) throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found.");

  // Look up each line's product+inventory snapshot server-side — price and
  // GST rate are never trusted from the client (spec: "pricing
  // server-authoritative," carried over from the MVP).
  const lineInputs: { productId: string; quantity: number; unitPrice: number; gstRate: number; product: any }[] = [];
  for (const line of params.items) {
    const inventory = await productRepo.findInventoryRow(params.distributionPartnerId, line.productId);
    if (!inventory) {
      throw new ApiError(400, "PRODUCT_NOT_IN_DISTRIBUTOR_CATALOG", `Product ${line.productId} is not in this distributor's catalog.`);
    }
    const product = await productRepo.findById(line.productId);
    if (!product) throw new ApiError(400, "PRODUCT_NOT_FOUND", `Product ${line.productId} not found.`);
    lineInputs.push({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: Number(inventory.price),
      gstRate: Number(inventory.gst_rate),
      product,
    });
  }

  const schemeLines = lineInputs.map((l) => ({
    key: l.productId,
    lineAmount: l.unitPrice * l.quantity,
    gstRate: l.gstRate,
  }));
  const breakdown = calculateSchemeBreakdown(schemeLines);
  const breakdownByKey = new Map(breakdown.lines.map((l) => [l.key, l]));

  const items: orderRepo.CreateOrderLineInput[] = lineInputs.map((l) => {
    const b = breakdownByKey.get(l.productId)!;
    return {
      productId: l.productId,
      skuCodeSnapshot: l.product.sku_code,
      productNameSnapshot: l.product.name,
      packSizeSnapshot: l.product.pack_size,
      uomSnapshot: l.product.uom,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      lineAmount: b.lineAmount,
      gstRateSnapshot: l.gstRate,
      tentativeLineDiscountAmount: b.lineDiscountAmount,
      tentativeLineGstAmount: b.lineGstAmount,
      tentativeLineTotal: b.lineTotal,
    };
  });

  const order = await orderRepo.createOrderWithItems({
    companyId,
    distributionPartnerId: params.distributionPartnerId,
    employeeId,
    retailerId: params.retailerId,
    beatId: null,
    beatVisitLogId: params.visitId ?? null,
    orderDate: istDateString(),
    clientUuid: params.clientUuid,
    totalQty: lineInputs.reduce((sum, l) => sum + l.quantity, 0),
    subtotalAmount: breakdown.subtotalAmount,
    tentativeDiscountPct: breakdown.discountPct,
    tentativeDiscountAmount: breakdown.discountAmount,
    tentativeTaxableAmount: breakdown.taxableAmount,
    tentativeGstAmount: breakdown.gstAmount,
    tentativeGrandTotalAmount: breakdown.grandTotalAmount,
    items,
  });

  const savedItems = await orderRepo.findItems(order.id);
  return toResult(order, savedItems);
}

export async function getOrder(employeeId: string, orderId: string): Promise<OrderResult> {
  const order = await orderRepo.findById(orderId);
  if (!order || order.employee_id !== employeeId) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  }
  const items = await orderRepo.findItems(order.id);
  return toResult(order, items);
}

// Order history — own orders, last 7 days (spec carries over from the MVP
// feature list, item 12).
export async function listMyRecentOrders(employeeId: string): Promise<OrderResult[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const orders = await orderRepo.listForEmployeeSince(employeeId, since);
  const results: OrderResult[] = [];
  for (const order of orders) {
    const items = await orderRepo.findItems(order.id);
    results.push(toResult(order, items));
  }
  return results;
}

export async function cancelOrder(employeeId: string, orderId: string): Promise<OrderResult> {
  const order = await orderRepo.findById(orderId);
  if (!order || order.employee_id !== employeeId) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  }
  if (order.order_date !== istDateString()) {
    throw new ApiError(409, "ORDER_CANCEL_WINDOW_CLOSED", "Orders can only be cancelled on the day they were booked.");
  }
  const updated = await orderRepo.cancelOrder(orderId);
  if (!updated) {
    throw new ApiError(409, "ORDER_NOT_CANCELLABLE", "This order can no longer be cancelled (already delivered or cancelled).");
  }
  const items = await orderRepo.findItems(updated.id);
  return toResult(updated, items);
}

// Delivery (distributor-side action, spec §8.7/§9): recomputes the scheme
// breakdown from the ACTUAL delivered quantities (defaulting to booked
// quantity per line when not overridden) — this is the "final" figure that
// is actually billed. DELIVERED is terminal: no further mutation after this.
export async function deliverOrder(
  orderId: string,
  overrides: { orderItemId: string; deliveredQuantity: number }[] = []
): Promise<OrderResult> {
  const order = await orderRepo.findById(orderId);
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  if (order.status !== "SUBMITTED") {
    throw new ApiError(409, "ORDER_NOT_DELIVERABLE", `Order is ${order.status.toLowerCase()} and cannot be delivered.`);
  }

  const items = await orderRepo.findItems(orderId);
  const overrideMap = new Map(overrides.map((o) => [o.orderItemId, o.deliveredQuantity]));

  const schemeLines = items.map((item) => {
    const deliveredQuantity = overrideMap.get(item.id) ?? item.quantity;
    return {
      key: item.id,
      lineAmount: Number(item.unit_price) * deliveredQuantity,
      gstRate: Number(item.gst_rate_snapshot),
      deliveredQuantity,
    };
  });
  const breakdown = calculateSchemeBreakdown(schemeLines);
  const deliveredQuantityByKey = new Map(schemeLines.map((l) => [l.key, l.deliveredQuantity]));

  const finalLineResults = new Map(
    breakdown.lines.map((l) => [
      l.key,
      {
        discountAmount: l.lineDiscountAmount,
        gstAmount: l.lineGstAmount,
        lineTotal: l.lineTotal,
        deliveredQuantity: deliveredQuantityByKey.get(l.key)!,
      },
    ])
  );

  const updated = await orderRepo.deliverOrder({
    orderId,
    deliveredQuantitiesByItemId: deliveredQuantityByKey,
    finalLineResults,
    deliveredSubtotalAmount: breakdown.subtotalAmount,
    finalDiscountPct: breakdown.discountPct,
    finalDiscountAmount: breakdown.discountAmount,
    finalTaxableAmount: breakdown.taxableAmount,
    finalGstAmount: breakdown.gstAmount,
    finalGrandTotalAmount: breakdown.grandTotalAmount,
  });
  if (!updated) {
    throw new ApiError(409, "ORDER_NOT_DELIVERABLE", "Order is no longer in a deliverable state.");
  }
  const finalItems = await orderRepo.findItems(orderId);
  return toResult(updated, finalItems);
}
