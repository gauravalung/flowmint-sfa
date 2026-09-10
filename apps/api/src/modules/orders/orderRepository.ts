import { pool } from "../../db/pool";
import { ApiError } from "../../lib/errors";
import { generateOrderNumber } from "../../lib/ids";

export interface OrderRow {
  id: string;
  order_number: string;
  company_id: string;
  distributor_id: string;
  employee_id: string;
  retailer_id: string;
  beat_id: string | null;
  beat_visit_log_id: string | null;
  order_date: string;
  status: "SUBMITTED" | "CANCELLED";
  total_qty: number;
  subtotal_amount: string;
  discount_pct: string;
  discount_amount: string;
  taxable_amount: string;
  gst_amount: string;
  grand_total_amount: string;
  client_uuid: string;
}

export interface OrderItemRow {
  id: string;
  sales_order_id: string;
  product_id: string;
  sku_code_snapshot: string;
  product_name_snapshot: string;
  pack_size_snapshot: string;
  uom_snapshot: string;
  unit_price: string;
  quantity: number;
  line_amount: string;
  line_discount_amount: string;
  gst_rate_snapshot: string;
  line_gst_amount: string;
  line_total: string;
}

export async function findByClientUuid(clientUuid: string): Promise<OrderRow | null> {
  const { rows } = await pool.query<OrderRow>(`SELECT * FROM sales_orders WHERE client_uuid = $1`, [
    clientUuid,
  ]);
  return rows[0] ?? null;
}

export async function findItemsByOrderId(orderId: string): Promise<OrderItemRow[]> {
  const { rows } = await pool.query<OrderItemRow>(
    `SELECT * FROM sales_order_items WHERE sales_order_id = $1 ORDER BY id ASC`,
    [orderId]
  );
  return rows;
}

export interface CreateOrderItemInput {
  productId: string;
  skuCodeSnapshot: string;
  productNameSnapshot: string;
  packSizeSnapshot: string;
  uomSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineAmount: number;
  lineDiscountAmount: number;
  gstRateSnapshot: number;
  lineGstAmount: number;
  lineTotal: number;
}

export interface CreateOrderInput {
  companyId: string;
  distributorId: string;
  employeeId: string;
  retailerId: string;
  beatId: string | null;
  visitId: string | null;
  orderDate: string;
  totalQty: number;
  subtotalAmount: number;
  discountPct: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  grandTotalAmount: number;
  clientUuid: string;
  items: CreateOrderItemInput[];
}

// Idempotent by client_uuid, same ON CONFLICT DO NOTHING + re-fetch pattern
// as visitRepository.createVisit, extended across two tables (order + its
// line items) inside one transaction. When the order is against a visit,
// that visit is closed as ORDER_BOOKED in the SAME transaction as the order
// insert — either both happen or neither does, so an order can never exist
// against a visit that wasn't actually closed, or vice versa. That
// atomicity requirement is exactly why the visit-close lives here rather
// than in orderService calling visitRepository.closeVisit separately.
export async function createOrder(
  input: CreateOrderInput
): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query<OrderRow>(
      `INSERT INTO sales_orders
         (order_number, company_id, distributor_id, employee_id, retailer_id, beat_id, beat_visit_log_id,
          order_date, total_qty, subtotal_amount, discount_pct, discount_amount, taxable_amount, gst_amount,
          grand_total_amount, client_uuid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (client_uuid) DO NOTHING
       RETURNING *`,
      [
        generateOrderNumber(),
        input.companyId,
        input.distributorId,
        input.employeeId,
        input.retailerId,
        input.beatId,
        input.visitId,
        input.orderDate,
        input.totalQty,
        input.subtotalAmount,
        input.discountPct,
        input.discountAmount,
        input.taxableAmount,
        input.gstAmount,
        input.grandTotalAmount,
        input.clientUuid,
      ]
    );

    if (!orderRows[0]) {
      // Retry of an already-submitted order — return what's actually there
      // instead of erroring or inserting duplicate line items.
      await client.query("ROLLBACK");
      const existing = await findByClientUuid(input.clientUuid);
      if (!existing) throw new Error("Order insert conflicted but no existing row found");
      const items = await findItemsByOrderId(existing.id);
      return { order: existing, items };
    }

    const order = orderRows[0];
    const itemRows: OrderItemRow[] = [];
    for (const item of input.items) {
      const { rows } = await client.query<OrderItemRow>(
        `INSERT INTO sales_order_items
           (sales_order_id, product_id, sku_code_snapshot, product_name_snapshot, pack_size_snapshot,
            uom_snapshot, unit_price, quantity, line_amount, line_discount_amount, gst_rate_snapshot,
            line_gst_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          order.id,
          item.productId,
          item.skuCodeSnapshot,
          item.productNameSnapshot,
          item.packSizeSnapshot,
          item.uomSnapshot,
          item.unitPrice,
          item.quantity,
          item.lineAmount,
          item.lineDiscountAmount,
          item.gstRateSnapshot,
          item.lineGstAmount,
          item.lineTotal,
        ]
      );
      itemRows.push(rows[0]);
    }

    if (input.visitId) {
      const { rowCount } = await client.query(
        `UPDATE beat_visit_log
         SET outcome = 'ORDER_BOOKED', check_out_at = now(), updated_at = now()
         WHERE id = $1 AND outcome = 'IN_PROGRESS'`,
        [input.visitId]
      );
      if (rowCount === 0) {
        // orderService already checked the visit was IN_PROGRESS moments
        // earlier, so this only fires on a genuine race (another close
        // request landed in between) — the client_uuid conflict above is
        // what protects against a plain retry. Fail the whole order rather
        // than leave a SUBMITTED order against a visit that isn't
        // IN_PROGRESS; the client_uuid means a safe retry either way.
        throw new ApiError(409, "VISIT_ALREADY_CLOSED", "This visit has already been closed.");
      }
    }

    await client.query("COMMIT");
    return { order, items: itemRows };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
