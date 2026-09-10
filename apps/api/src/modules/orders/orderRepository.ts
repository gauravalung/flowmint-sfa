import { PoolClient } from "pg";
import { pool } from "../../db/pool";

export interface SalesOrderRow {
  id: string;
  order_number: string;
  company_id: string;
  distribution_partner_id: string;
  employee_id: string;
  retailer_id: string;
  beat_id: string | null;
  beat_visit_log_id: string | null;
  order_date: string;
  status: "SUBMITTED" | "SAVED" | "CANCELLED" | "DELIVERED";
  total_qty: number;
  subtotal_amount: string;
  tentative_discount_pct: string;
  tentative_discount_amount: string;
  tentative_taxable_amount: string;
  tentative_gst_amount: string;
  tentative_grand_total_amount: string;
  delivered_subtotal_amount: string | null;
  final_discount_pct: string | null;
  final_discount_amount: string | null;
  final_taxable_amount: string | null;
  final_gst_amount: string | null;
  final_grand_total_amount: string | null;
  cancelled_at: Date | null;
  delivered_at: Date | null;
  client_uuid: string;
  created_at: Date;
}

export interface SalesOrderItemRow {
  id: string;
  sales_order_id: string;
  product_id: string;
  sku_code_snapshot: string;
  product_name_snapshot: string;
  pack_size_snapshot: string;
  uom_snapshot: string;
  unit_price: string;
  quantity: number;
  delivered_quantity: number | null;
  line_amount: string;
  gst_rate_snapshot: string;
  tentative_line_discount_amount: string;
  tentative_line_gst_amount: string;
  tentative_line_total: string;
  final_line_discount_amount: string | null;
  final_line_gst_amount: string | null;
  final_line_total: string | null;
}

export async function findByClientUuid(clientUuid: string): Promise<SalesOrderRow | null> {
  const { rows } = await pool.query<SalesOrderRow>(`SELECT * FROM sales_orders WHERE client_uuid = $1`, [
    clientUuid,
  ]);
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<SalesOrderRow | null> {
  const { rows } = await pool.query<SalesOrderRow>(`SELECT * FROM sales_orders WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findItems(salesOrderId: string): Promise<SalesOrderItemRow[]> {
  const { rows } = await pool.query<SalesOrderItemRow>(
    `SELECT * FROM sales_order_items WHERE sales_order_id = $1 ORDER BY id`,
    [salesOrderId]
  );
  return rows;
}

export async function listForEmployeeSince(employeeId: string, sinceDate: string): Promise<SalesOrderRow[]> {
  const { rows } = await pool.query<SalesOrderRow>(
    `SELECT * FROM sales_orders WHERE employee_id = $1 AND order_date >= $2 ORDER BY created_at DESC`,
    [employeeId, sinceDate]
  );
  return rows;
}

function generateOrderNumber(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `ORD-${y}${m}${d}-${rand}`;
}

export interface CreateOrderLineInput {
  productId: string;
  skuCodeSnapshot: string;
  productNameSnapshot: string;
  packSizeSnapshot: string;
  uomSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineAmount: number;
  gstRateSnapshot: number;
  tentativeLineDiscountAmount: number;
  tentativeLineGstAmount: number;
  tentativeLineTotal: number;
}

// Idempotent by client_uuid — same outbox-retry pattern as beat_visit_log.
export async function createOrderWithItems(params: {
  companyId: string;
  distributionPartnerId: string;
  employeeId: string;
  retailerId: string;
  beatId: string | null;
  beatVisitLogId: string | null;
  orderDate: string;
  clientUuid: string;
  totalQty: number;
  subtotalAmount: number;
  tentativeDiscountPct: number;
  tentativeDiscountAmount: number;
  tentativeTaxableAmount: number;
  tentativeGstAmount: number;
  tentativeGrandTotalAmount: number;
  items: CreateOrderLineInput[];
}): Promise<SalesOrderRow> {
  const existing = await findByClientUuid(params.clientUuid);
  if (existing) return existing;

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<SalesOrderRow>(
      `INSERT INTO sales_orders
         (order_number, company_id, distribution_partner_id, employee_id, retailer_id, beat_id, beat_visit_log_id,
          order_date, status, total_qty, subtotal_amount, tentative_discount_pct, tentative_discount_amount,
          tentative_taxable_amount, tentative_gst_amount, tentative_grand_total_amount, client_uuid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUBMITTED', $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (client_uuid) DO NOTHING
       RETURNING *`,
      [
        generateOrderNumber(new Date()),
        params.companyId,
        params.distributionPartnerId,
        params.employeeId,
        params.retailerId,
        params.beatId,
        params.beatVisitLogId,
        params.orderDate,
        params.totalQty,
        params.subtotalAmount,
        params.tentativeDiscountPct,
        params.tentativeDiscountAmount,
        params.tentativeTaxableAmount,
        params.tentativeGstAmount,
        params.tentativeGrandTotalAmount,
        params.clientUuid,
      ]
    );

    if (!rows[0]) {
      // Lost the race to a concurrent retry with the same client_uuid.
      await client.query("ROLLBACK");
      const raced = await findByClientUuid(params.clientUuid);
      if (!raced) throw new Error("Order insert conflicted but no existing row found");
      return raced;
    }

    const order = rows[0];
    for (const item of params.items) {
      await client.query(
        `INSERT INTO sales_order_items
           (sales_order_id, product_id, sku_code_snapshot, product_name_snapshot, pack_size_snapshot, uom_snapshot,
            unit_price, quantity, line_amount, gst_rate_snapshot, tentative_line_discount_amount,
            tentative_line_gst_amount, tentative_line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
          item.gstRateSnapshot,
          item.tentativeLineDiscountAmount,
          item.tentativeLineGstAmount,
          item.tentativeLineTotal,
        ]
      );
    }

    await client.query("COMMIT");
    return order;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelOrder(id: string): Promise<SalesOrderRow | null> {
  const { rows } = await pool.query<SalesOrderRow>(
    `UPDATE sales_orders SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
     WHERE id = $1 AND status IN ('SUBMITTED', 'SAVED')
     RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}

// Delivery: sets each line's delivered_quantity (defaulting to the booked
// quantity when not overridden) and the order's final_* figures, all in one
// transaction. Terminal — DELIVERED can never be mutated again (spec §8.7).
export async function deliverOrder(params: {
  orderId: string;
  deliveredQuantitiesByItemId: Map<string, number>;
  finalLineResults: Map<string, { discountAmount: number; gstAmount: number; lineTotal: number; deliveredQuantity: number }>;
  deliveredSubtotalAmount: number;
  finalDiscountPct: number;
  finalDiscountAmount: number;
  finalTaxableAmount: number;
  finalGstAmount: number;
  finalGrandTotalAmount: number;
}): Promise<SalesOrderRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<SalesOrderRow>(
      `SELECT * FROM sales_orders WHERE id = $1 AND status = 'SUBMITTED' FOR UPDATE`,
      [params.orderId]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    for (const [itemId, result] of params.finalLineResults) {
      await client.query(
        `UPDATE sales_order_items
         SET delivered_quantity = $2, final_line_discount_amount = $3, final_line_gst_amount = $4, final_line_total = $5
         WHERE id = $1`,
        [itemId, result.deliveredQuantity, result.discountAmount, result.gstAmount, result.lineTotal]
      );
    }

    const { rows: updatedOrder } = await client.query<SalesOrderRow>(
      `UPDATE sales_orders
       SET status = 'DELIVERED', delivered_at = now(), updated_at = now(),
           delivered_subtotal_amount = $2, final_discount_pct = $3, final_discount_amount = $4,
           final_taxable_amount = $5, final_gst_amount = $6, final_grand_total_amount = $7
       WHERE id = $1
       RETURNING *`,
      [
        params.orderId,
        params.deliveredSubtotalAmount,
        params.finalDiscountPct,
        params.finalDiscountAmount,
        params.finalTaxableAmount,
        params.finalGstAmount,
        params.finalGrandTotalAmount,
      ]
    );

    await client.query("COMMIT");
    return updatedOrder[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
