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

export interface CategoryRow {
  id: string;
  name: string;
}

export async function findCategories(): Promise<CategoryRow[]> {
  const { rows } = await pool.query<CategoryRow>(
    `SELECT id, name FROM categories WHERE is_active = true ORDER BY name ASC`
  );
  return rows;
}

// 2,500+ SKUs (see SFA_MVP_Scope_Locked.md's revision after real catalog
// size was known) — server-side search + category filter + pagination
// rather than a flat list, mirroring retailerRepository.searchRetailers.
export async function searchProducts(
  search: string,
  categoryId: string | null,
  page: number,
  pageSize: number
): Promise<{ rows: ProductWithNamesRow[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const likeTerm = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const { rows } = await pool.query<ProductWithNamesRow>(
    `SELECT p.*, b.name AS brand_name, c.name AS category_name
     FROM products p
     JOIN brands b ON b.id = p.brand_id
     JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = true
       AND ($1 = '' OR p.name ILIKE $2 OR p.sku_code ILIKE $2)
       AND ($3::uuid IS NULL OR p.category_id = $3)
     ORDER BY p.name ASC
     LIMIT $4 OFFSET $5`,
    [search, likeTerm, categoryId, pageSize, offset]
  );
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM products p
     WHERE p.is_active = true
       AND ($1 = '' OR p.name ILIKE $2 OR p.sku_code ILIKE $2)
       AND ($3::uuid IS NULL OR p.category_id = $3)`,
    [search, likeTerm, categoryId]
  );
  return { rows, total: Number(countRows[0].count) };
}

// Used by order creation to fetch the server-authoritative price/GST rate/
// name to snapshot onto the order lines — never trusts anything about a
// product except its id from the client.
export async function findByIds(ids: string[]): Promise<ProductRow[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query<ProductRow>(
    `SELECT * FROM products WHERE id = ANY($1::uuid[]) AND is_active = true`,
    [ids]
  );
  return rows;
}
