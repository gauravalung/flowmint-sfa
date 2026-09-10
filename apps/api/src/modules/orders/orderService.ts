import { ApiError } from "../../lib/errors";
import * as orderRepo from "./orderRepository";
import * as retailerRepo from "../retailers/retailerRepository";
import * as visitRepo from "../visits/visitRepository";
import * as productRepo from "../products/productRepository";
import * as distributorService from "../distributors/distributorService";
import { computeOrderTotals } from "@flowmint/shared";
import { istDateString } from "../../lib/istDate";
import type { CartLineInput, OrderResult } from "@flowmint/shared";

function toOrderResult(order: orderRepo.OrderRow, items: orderRepo.OrderItemRow[]): OrderResult {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    orderDate: order.order_date,
    retailerId: order.retailer_id,
    subtotalAmount: order.subtotal_amount,
    discountPct: order.discount_pct,
    discountAmount: order.discount_amount,
    taxableAmount: order.taxable_amount,
    gstAmount: order.gst_amount,
    grandTotalAmount: order.grand_total_amount,
    items: items.map((i) => ({
      productId: i.product_id,
      skuCodeSnapshot: i.sku_code_snapshot,
      productNameSnapshot: i.product_name_snapshot,
      packSizeSnapshot: i.pack_size_snapshot,
      uomSnapshot: i.uom_snapshot,
      unitPrice: i.unit_price,
      quantity: i.quantity,
      lineAmount: i.line_amount,
      lineDiscountAmount: i.line_discount_amount,
      gstRateSnapshot: i.gst_rate_snapshot,
      lineGstAmount: i.line_gst_amount,
      lineTotal: i.line_total,
    })),
  };
}

export async function createOrder(
  employeeId: string,
  params: {
    clientUuid: string;
    distributorId: string;
    retailerId: string;
    visitId?: string;
    items: CartLineInput[];
  }
): Promise<OrderResult> {
  // Retry-safe up front: if this exact submission already landed, return it
  // as-is without re-validating retailer/visit/products against current
  // state — the order is already final, and current state may have moved
  // on since (e.g. a product price change) without that making the
  // already-committed order wrong.
  const existingOrder = await orderRepo.findByClientUuid(params.clientUuid);
  if (existingOrder) {
    const items = await orderRepo.findItemsByOrderId(existingOrder.id);
    return toOrderResult(existingOrder, items);
  }

  const { companyId, distributorId } = await distributorService.requireDistributorAccess(
    employeeId,
    params.distributorId
  );

  const retailer = await retailerRepo.findById(params.retailerId);
  if (!retailer || retailer.distributor_id !== distributorId) {
    throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found.");
  }

  // beat_id is derived from the visit, never taken from the client — the
  // visit already recorded which beat (if any) this call was made under.
  let beatId: string | null = null;
  if (params.visitId) {
    const visit = await visitRepo.findById(params.visitId);
    if (!visit || visit.employee_id !== employeeId || visit.retailer_id !== params.retailerId) {
      throw new ApiError(404, "VISIT_NOT_FOUND", "Visit not found.");
    }
    if (visit.outcome !== "IN_PROGRESS") {
      throw new ApiError(409, "VISIT_ALREADY_CLOSED", "This visit has already been closed.");
    }
    beatId = visit.beat_id;
  }

  // Dedupe requested product ids — a duplicated line shouldn't fetch or
  // price the same product twice.
  const requestedIds = [...new Set(params.items.map((i) => i.productId))];
  const products = await productRepo.findByIds(requestedIds);
  const productById = new Map(products.map((p) => [p.id, p]));

  const missing = requestedIds.filter((id) => !productById.has(id));
  if (missing.length > 0) {
    throw new ApiError(400, "PRODUCT_NOT_FOUND", "One or more products are no longer available.", {
      productIds: missing,
    });
  }

  // Pricing is always the server's current product price/GST rate — never
  // anything the client sent, however the catalog screen displayed it.
  const totals = computeOrderTotals(
    params.items.map((line) => {
      const product = productById.get(line.productId)!;
      return {
        productId: product.id,
        unitPrice: Number(product.price),
        quantity: line.quantity,
        gstRate: Number(product.gst_rate),
      };
    })
  );

  const items: orderRepo.CreateOrderItemInput[] = totals.lines.map((line) => {
    const product = productById.get(line.productId)!;
    return {
      productId: product.id,
      skuCodeSnapshot: product.sku_code,
      productNameSnapshot: product.name,
      packSizeSnapshot: product.pack_size,
      uomSnapshot: product.uom,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineAmount: line.lineAmount,
      lineDiscountAmount: line.lineDiscountAmount,
      gstRateSnapshot: line.gstRate,
      lineGstAmount: line.lineGstAmount,
      lineTotal: line.lineTotal,
    };
  });

  const totalQty = params.items.reduce((sum, i) => sum + i.quantity, 0);

  const { order, items: savedItems } = await orderRepo.createOrder({
    companyId,
    distributorId,
    employeeId,
    retailerId: params.retailerId,
    beatId,
    visitId: params.visitId ?? null,
    orderDate: istDateString(),
    totalQty,
    subtotalAmount: totals.subtotalAmount,
    discountPct: totals.discountPct,
    discountAmount: totals.discountAmount,
    taxableAmount: totals.taxableAmount,
    gstAmount: totals.gstAmount,
    grandTotalAmount: totals.grandTotalAmount,
    clientUuid: params.clientUuid,
    items,
  });

  return toOrderResult(order, savedItems);
}
