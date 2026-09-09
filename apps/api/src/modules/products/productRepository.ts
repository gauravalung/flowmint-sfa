import { pool } from "../../db/pool";

export interface ProductRow {
  id: string;
  company_id: string;
  brand_id: string;
  category_id: string;
  sku_code: string;
  name: string;
  pack_size: string;
  uom: string;
  mrp: string;
  price: string;
  gst_rate: string;
  is_active: boolean;
}

export interface ProductWithNamesRow extends ProductRow {
  brand_name: string;
  category_name: string;
}

export async function findBySkuCode(skuCode: string): Promise<ProductRow | null> {
  const { rows } = await pool.query<ProductRow>(`SELECT * FROM products WHERE sku_code = $1`, [skuCode]);
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<ProductRow | null> {
  const { rows } = await pool.query<ProductRow>(`SELECT * FROM products WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function create(params: {
  companyId: string;
  brandId: string;
  categoryId: string;
  skuCode: string;
  name: string;
  packSize: string;
  uom: string;
  mrp: number;
  price: number;
  gstRate: number;
}): Promise<ProductRow> {
  const { rows } = await pool.query<ProductRow>(
    `INSERT INTO products (company_id, brand_id, category_id, sku_code, name, pack_size, uom, mrp, price, gst_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.companyId,
      params.brandId,
      params.categoryId,
      params.skuCode,
      params.name,
      params.packSize,
      params.uom,
      params.mrp,
      params.price,
      params.gstRate,
    ]
  );
  return rows[0];
}

// Company-wide catalog list (admin) — not scoped to any one distributor's
// inventory, unlike findInventoryForDistributor below.
export async function list(filter: {
  search?: string;
  categoryId?: string;
  page: number;
  pageSize: number;
}): Promise<{ rows: ProductWithNamesRow[]; total: number }> {
  const conditions = [`p.is_active = true`];
  const params: unknown[] = [];
  if (filter.search) {
    params.push(`%${filter.search.replace(/[%_]/g, (m) => `\\${m}`)}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.sku_code ILIKE $${params.length})`);
  }
  if (filter.categoryId) {
    params.push(filter.categoryId);
    conditions.push(`p.category_id = $${params.length}`);
  }
  const where = conditions.join(" AND ");
  const offset = (filter.page - 1) * filter.pageSize;

  const { rows } = await pool.query<ProductWithNamesRow>(
    `SELECT p.*, b.name AS brand_name, c.name AS category_name
     FROM products p
     JOIN brands b ON b.id = p.brand_id
     JOIN categories c ON c.id = p.category_id
     WHERE ${where}
     ORDER BY p.name ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filter.pageSize, offset]
  );
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM products p WHERE ${where}`,
    params
  );
  return { rows, total: Number(countRows[0].count) };
}

export interface DistributorProductRow extends ProductWithNamesRow {
  available_qty: number;
  is_focus_product: boolean;
}

// "Open the selected distributor's inventory" (spec §8.6) — join products
// with the distributor-specific overlay, not a duplicated product row.
export async function findInventoryForDistributor(
  distributionPartnerId: string,
  filter: { search?: string; focusOnly?: boolean; inStockOnly?: boolean; sort: "name" | "mrp"; page: number; pageSize: number }
): Promise<{ rows: DistributorProductRow[]; total: number }> {
  const conditions = [`dpi.distribution_partner_id = $1`, `dpi.is_active = true`, `p.is_active = true`];
  const params: unknown[] = [distributionPartnerId];

  if (filter.search) {
    params.push(`%${filter.search.replace(/[%_]/g, (m) => `\\${m}`)}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.sku_code ILIKE $${params.length})`);
  }
  if (filter.focusOnly) conditions.push(`dpi.is_focus_product = true`);
  if (filter.inStockOnly) conditions.push(`dpi.available_qty > 0`);

  const where = conditions.join(" AND ");
  const orderBy = filter.sort === "mrp" ? "p.mrp ASC" : "p.name ASC";
  const offset = (filter.page - 1) * filter.pageSize;

  const { rows } = await pool.query<DistributorProductRow>(
    `SELECT p.*, b.name AS brand_name, c.name AS category_name, dpi.available_qty, dpi.is_focus_product
     FROM distribution_partner_product_inventory dpi
     JOIN products p ON p.id = dpi.product_id
     JOIN brands b ON b.id = p.brand_id
     JOIN categories c ON c.id = p.category_id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filter.pageSize, offset]
  );
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM distribution_partner_product_inventory dpi
     JOIN products p ON p.id = dpi.product_id
     WHERE ${where}`,
    params
  );
  return { rows, total: Number(countRows[0].count) };
}

export async function findInventoryRow(
  distributionPartnerId: string,
  productId: string
): Promise<{ available_qty: number; gst_rate: string; price: string } | null> {
  const { rows } = await pool.query(
    `SELECT dpi.available_qty, p.gst_rate, p.price
     FROM distribution_partner_product_inventory dpi
     JOIN products p ON p.id = dpi.product_id
     WHERE dpi.distribution_partner_id = $1 AND dpi.product_id = $2 AND dpi.is_active = true AND p.is_active = true`,
    [distributionPartnerId, productId]
  );
  return rows[0] ?? null;
}

export async function upsertInventory(params: {
  distributionPartnerId: string;
  productId: string;
  availableQty: number;
  isFocusProduct: boolean;
}): Promise<void> {
  await pool.query(
    `INSERT INTO distribution_partner_product_inventory (distribution_partner_id, product_id, available_qty, is_focus_product)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (distribution_partner_id, product_id)
       DO UPDATE SET available_qty = $3, is_focus_product = $4, is_active = true, updated_at = now()`,
    [params.distributionPartnerId, params.productId, params.availableQty, params.isFocusProduct]
  );
}

export async function decrementAvailableQty(
  distributionPartnerId: string,
  productId: string,
  quantity: number
): Promise<void> {
  await pool.query(
    `UPDATE distribution_partner_product_inventory
     SET available_qty = GREATEST(available_qty - $3, 0), updated_at = now()
     WHERE distribution_partner_id = $1 AND product_id = $2`,
    [distributionPartnerId, productId, quantity]
  );
}
