import { pool } from "../../db/pool";

export interface VisitRow {
  id: string;
  employee_id: string;
  retailer_id: string;
  beat_id: string | null;
  visit_date: string;
  check_in_at: Date;
  check_out_at: Date | null;
  outcome: "IN_PROGRESS" | "ORDER_BOOKED" | "NO_ORDER";
  no_order_reason: string | null;
  is_off_beat: boolean;
  client_uuid: string;
}

// Keyed by retailer_id — used to paint visit status onto today's beat list.
export async function findVisitsForEmployeeOnDate(
  employeeId: string,
  visitDate: string
): Promise<Map<string, { id: string; outcome: VisitRow["outcome"] }>> {
  const { rows } = await pool.query<{ id: string; retailer_id: string; outcome: VisitRow["outcome"] }>(
    `SELECT id, retailer_id, outcome FROM beat_visit_log WHERE employee_id = $1 AND visit_date = $2`,
    [employeeId, visitDate]
  );
  const map = new Map<string, { id: string; outcome: VisitRow["outcome"] }>();
  for (const row of rows) map.set(row.retailer_id, { id: row.id, outcome: row.outcome });
  return map;
}

export async function findById(id: string): Promise<VisitRow | null> {
  const { rows } = await pool.query<VisitRow>(`SELECT * FROM beat_visit_log WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findByClientUuid(clientUuid: string): Promise<VisitRow | null> {
  const { rows } = await pool.query<VisitRow>(`SELECT * FROM beat_visit_log WHERE client_uuid = $1`, [
    clientUuid,
  ]);
  return rows[0] ?? null;
}

// Idempotent by client_uuid — the mobile outbox may retry a "start visit"
// submission after a flaky connection without knowing whether the first
// attempt actually landed. ON CONFLICT DO NOTHING + re-fetch means a retry
// returns the original visit instead of erroring or creating a duplicate.
export async function createVisit(params: {
  employeeId: string;
  retailerId: string;
  beatId: string | null;
  visitDate: string;
  isOffBeat: boolean;
  clientUuid: string;
}): Promise<VisitRow> {
  const { rows } = await pool.query<VisitRow>(
    `INSERT INTO beat_visit_log (employee_id, retailer_id, beat_id, visit_date, check_in_at, is_off_beat, client_uuid)
     VALUES ($1, $2, $3, $4, now(), $5, $6)
     ON CONFLICT (client_uuid) DO NOTHING
     RETURNING *`,
    [params.employeeId, params.retailerId, params.beatId, params.visitDate, params.isOffBeat, params.clientUuid]
  );
  if (rows[0]) return rows[0];
  const existing = await findByClientUuid(params.clientUuid);
  if (!existing) throw new Error("Visit insert conflicted but no existing row found");
  return existing;
}

export async function closeVisit(
  id: string,
  outcome: "ORDER_BOOKED" | "NO_ORDER",
  noOrderReason: string | null
): Promise<VisitRow | null> {
  const { rows } = await pool.query<VisitRow>(
    `UPDATE beat_visit_log
     SET outcome = $2, no_order_reason = $3, check_out_at = now(), updated_at = now()
     WHERE id = $1 AND outcome = 'IN_PROGRESS'
     RETURNING *`,
    [id, outcome, noOrderReason]
  );
  return rows[0] ?? null;
}
