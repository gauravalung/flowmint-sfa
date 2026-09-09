import { pool } from "../../db/pool";

export type StatusEntityType = "DISTRIBUTION_PARTNER" | "RETAILER";

export interface StatusChangeLogRow {
  id: string;
  entity_type: StatusEntityType;
  entity_id: string;
  previous_status: boolean;
  new_status: boolean;
  changed_at: Date;
  changed_by_employee_id: string | null;
  reason: string | null;
}

// One generic audit table for every entity that carries Active/Inactive
// tracking (spec §4) — not one table per entity type, so adding a new
// trackable entity later is one CHECK-constraint value, not a new table.
export async function recordStatusChange(params: {
  entityType: StatusEntityType;
  entityId: string;
  previousStatus: boolean;
  newStatus: boolean;
  changedByEmployeeId: string;
  reason?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO status_change_log (entity_type, entity_id, previous_status, new_status, changed_by_employee_id, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.entityType,
      params.entityId,
      params.previousStatus,
      params.newStatus,
      params.changedByEmployeeId,
      params.reason ?? null,
    ]
  );
}

export async function findHistoryForEntity(
  entityType: StatusEntityType,
  entityId: string
): Promise<StatusChangeLogRow[]> {
  const { rows } = await pool.query<StatusChangeLogRow>(
    `SELECT * FROM status_change_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY changed_at DESC`,
    [entityType, entityId]
  );
  return rows;
}

export async function findRecentChanges(
  entityType: StatusEntityType | null,
  limit: number
): Promise<StatusChangeLogRow[]> {
  if (entityType) {
    const { rows } = await pool.query<StatusChangeLogRow>(
      `SELECT * FROM status_change_log WHERE entity_type = $1 ORDER BY changed_at DESC LIMIT $2`,
      [entityType, limit]
    );
    return rows;
  }
  const { rows } = await pool.query<StatusChangeLogRow>(
    `SELECT * FROM status_change_log ORDER BY changed_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
