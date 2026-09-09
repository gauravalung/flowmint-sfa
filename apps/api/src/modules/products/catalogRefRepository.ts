// Small helpers for brands/categories — unchanged tables from the MVP.
// find-or-create-by-name backs bulk product upload (spec §11), where a row
// may name a brand/category that doesn't exist yet.
import { pool } from "../../db/pool";

export interface RefRow {
  id: string;
  name: string;
}

export async function findBrandByName(name: string): Promise<RefRow | null> {
  const { rows } = await pool.query<RefRow>(`SELECT id, name FROM brands WHERE name = $1`, [name]);
  return rows[0] ?? null;
}

export async function findOrCreateBrandByName(name: string): Promise<RefRow> {
  const existing = await findBrandByName(name);
  if (existing) return existing;
  const { rows } = await pool.query<RefRow>(`INSERT INTO brands (name) VALUES ($1) RETURNING id, name`, [name]);
  return rows[0];
}

export async function findCategoryByName(name: string): Promise<RefRow | null> {
  const { rows } = await pool.query<RefRow>(`SELECT id, name FROM categories WHERE name = $1`, [name]);
  return rows[0] ?? null;
}

export async function findOrCreateCategoryByName(name: string): Promise<RefRow> {
  const existing = await findCategoryByName(name);
  if (existing) return existing;
  const { rows } = await pool.query<RefRow>(`INSERT INTO categories (name) VALUES ($1) RETURNING id, name`, [name]);
  return rows[0];
}
