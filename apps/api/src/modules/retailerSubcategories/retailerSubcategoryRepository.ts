import { pool } from "../../db/pool";

export interface RetailerSubcategoryRow {
  id: string;
  name: string;
  is_active: boolean;
}

export async function list(activeOnly = false): Promise<RetailerSubcategoryRow[]> {
  const where = activeOnly ? "WHERE is_active = true" : "";
  const { rows } = await pool.query<RetailerSubcategoryRow>(
    `SELECT * FROM retailer_subcategories ${where} ORDER BY name ASC`
  );
  return rows;
}

export async function findByName(name: string): Promise<RetailerSubcategoryRow | null> {
  const { rows } = await pool.query<RetailerSubcategoryRow>(
    `SELECT * FROM retailer_subcategories WHERE name = $1`,
    [name]
  );
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<RetailerSubcategoryRow | null> {
  const { rows } = await pool.query<RetailerSubcategoryRow>(
    `SELECT * FROM retailer_subcategories WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function create(name: string): Promise<RetailerSubcategoryRow> {
  const { rows } = await pool.query<RetailerSubcategoryRow>(
    `INSERT INTO retailer_subcategories (name) VALUES ($1) RETURNING *`,
    [name]
  );
  return rows[0];
}

export async function setActive(id: string, isActive: boolean): Promise<RetailerSubcategoryRow | null> {
  const { rows } = await pool.query<RetailerSubcategoryRow>(
    `UPDATE retailer_subcategories SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, isActive]
  );
  return rows[0] ?? null;
}

// Idempotent lookup-or-create by name — used by bulk retailer upload, where
// a row may name a subcategory that doesn't exist yet ("admin can add new
// sub-categories with no code change," spec §5) without failing the row.
export async function findOrCreateByName(name: string): Promise<RetailerSubcategoryRow> {
  const existing = await findByName(name);
  if (existing) return existing;
  return create(name);
}
