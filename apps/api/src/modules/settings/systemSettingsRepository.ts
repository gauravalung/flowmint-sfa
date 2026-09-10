import { pool } from "../../db/pool";

export interface SystemSettingRow {
  key: string;
  value: unknown;
  updated_at: Date;
}

export async function findByKey(key: string): Promise<SystemSettingRow | null> {
  const { rows } = await pool.query<SystemSettingRow>(`SELECT * FROM system_settings WHERE key = $1`, [key]);
  return rows[0] ?? null;
}

export async function list(): Promise<SystemSettingRow[]> {
  const { rows } = await pool.query<SystemSettingRow>(`SELECT * FROM system_settings ORDER BY key ASC`);
  return rows;
}

export async function upsert(key: string, value: unknown, updatedByEmployeeId: string): Promise<SystemSettingRow> {
  const { rows } = await pool.query<SystemSettingRow>(
    `INSERT INTO system_settings (key, value, updated_by_employee_id)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_by_employee_id = $3, updated_at = now()
     RETURNING *`,
    [key, JSON.stringify(value), updatedByEmployeeId]
  );
  return rows[0];
}
