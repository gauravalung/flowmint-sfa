// Repository functions for the six mapping tables in spec §6. Each table
// gets its own small set of functions (the column names genuinely differ)
// but every one follows the same shape: create-or-reactivate, deactivate,
// list-active. Deactivation is always soft (is_active=false,
// deactivated_at set) — removing one mapping never touches another row,
// and history survives for audit.
import { pool } from "../../db/pool";

export const BEAT_RETAILER_CAP = 40;

export interface MappingRow {
  id: string;
  is_active: boolean;
  deactivated_at: Date | null;
}

// ---------------------------------------------------------------------------
// distribution_partner_beat_mapping
// ---------------------------------------------------------------------------

export async function mapDistributionPartnerBeat(
  distributionPartnerId: string,
  beatId: string
): Promise<MappingRow> {
  const { rows } = await pool.query<MappingRow>(
    `INSERT INTO distribution_partner_beat_mapping (distribution_partner_id, beat_id)
     VALUES ($1, $2)
     ON CONFLICT (distribution_partner_id, beat_id)
       DO UPDATE SET is_active = true, deactivated_at = NULL, updated_at = now()
     RETURNING id, is_active, deactivated_at`,
    [distributionPartnerId, beatId]
  );
  return rows[0];
}

export async function unmapDistributionPartnerBeat(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE distribution_partner_beat_mapping SET is_active = false, deactivated_at = now(), updated_at = now()
     WHERE id = $1 AND is_active = true`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// beat_retailer_mapping (40-outlet cap, spec §7)
// ---------------------------------------------------------------------------

export async function countActiveRetailersForBeat(beatId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM beat_retailer_mapping WHERE beat_id = $1 AND is_active = true`,
    [beatId]
  );
  return Number(rows[0].count);
}

export async function nextSequenceNoForBeat(beatId: string): Promise<number> {
  const { rows } = await pool.query<{ max: number | null }>(
    `SELECT max(sequence_no) AS max FROM beat_retailer_mapping WHERE beat_id = $1`,
    [beatId]
  );
  return (rows[0].max ?? 0) + 1;
}

export class BeatCapacityExceededError extends Error {}

// Transaction-scoped: locks the beat row first (SELECT ... FOR UPDATE) so
// two concurrent admin requests mapping the 40th and 41st retailer can't
// both read "39 active" and both succeed — the second waits for the first
// transaction to commit (or roll back) before it can even count. See
// spec §7.
export async function mapBeatRetailerWithCapCheck(
  beatId: string,
  retailerId: string,
  sequenceNo: number | null
): Promise<MappingRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM beats WHERE id = $1 FOR UPDATE`, [beatId]);

    const { rows: existingRows } = await client.query<MappingRow>(
      `SELECT id, is_active, deactivated_at FROM beat_retailer_mapping WHERE beat_id = $1 AND retailer_id = $2`,
      [beatId, retailerId]
    );
    const alreadyActive = existingRows[0]?.is_active === true;

    if (!alreadyActive) {
      const { rows: countRows } = await client.query<{ count: string }>(
        `SELECT count(*) FROM beat_retailer_mapping WHERE beat_id = $1 AND is_active = true`,
        [beatId]
      );
      if (Number(countRows[0].count) >= BEAT_RETAILER_CAP) {
        await client.query("ROLLBACK");
        throw new BeatCapacityExceededError(`Beat already has ${BEAT_RETAILER_CAP} active retailers.`);
      }
    }

    const resolvedSequenceNo =
      sequenceNo ??
      (await client
        .query<{ max: number | null }>(`SELECT max(sequence_no) AS max FROM beat_retailer_mapping WHERE beat_id = $1`, [
          beatId,
        ])
        .then((r) => (r.rows[0].max ?? 0) + 1));

    const { rows } = await client.query<MappingRow>(
      `INSERT INTO beat_retailer_mapping (beat_id, retailer_id, sequence_no)
       VALUES ($1, $2, $3)
       ON CONFLICT (beat_id, retailer_id)
         DO UPDATE SET is_active = true, deactivated_at = NULL, sequence_no = EXCLUDED.sequence_no, updated_at = now()
       RETURNING id, is_active, deactivated_at`,
      [beatId, retailerId, resolvedSequenceNo]
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function unmapBeatRetailer(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE beat_retailer_mapping SET is_active = false, deactivated_at = now(), updated_at = now()
     WHERE id = $1 AND is_active = true`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// retailer_distribution_partner_mapping
// ---------------------------------------------------------------------------

export async function mapRetailerDistributionPartner(
  retailerId: string,
  distributionPartnerId: string
): Promise<MappingRow> {
  const { rows } = await pool.query<MappingRow>(
    `INSERT INTO retailer_distribution_partner_mapping (retailer_id, distribution_partner_id)
     VALUES ($1, $2)
     ON CONFLICT (retailer_id, distribution_partner_id)
       DO UPDATE SET is_active = true, deactivated_at = NULL, updated_at = now()
     RETURNING id, is_active, deactivated_at`,
    [retailerId, distributionPartnerId]
  );
  return rows[0];
}

export async function unmapRetailerDistributionPartner(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE retailer_distribution_partner_mapping SET is_active = false, deactivated_at = now(), updated_at = now()
     WHERE id = $1 AND is_active = true`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// employee_distribution_partner_mapping
// ---------------------------------------------------------------------------

export async function mapEmployeeDistributionPartner(
  employeeId: string,
  distributionPartnerId: string
): Promise<MappingRow> {
  const { rows } = await pool.query<MappingRow>(
    `INSERT INTO employee_distribution_partner_mapping (employee_id, distribution_partner_id)
     VALUES ($1, $2)
     ON CONFLICT (employee_id, distribution_partner_id)
       DO UPDATE SET is_active = true, deactivated_at = NULL, updated_at = now()
     RETURNING id, is_active, deactivated_at`,
    [employeeId, distributionPartnerId]
  );
  return rows[0];
}

export async function unmapEmployeeDistributionPartner(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE employee_distribution_partner_mapping SET is_active = false, deactivated_at = now(), updated_at = now()
     WHERE id = $1 AND is_active = true`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// employee_beat_mapping (carries the legacy day_of_week fallback)
// ---------------------------------------------------------------------------

export async function mapEmployeeBeat(
  employeeId: string,
  beatId: string,
  dayOfWeek: number | null
): Promise<MappingRow> {
  const { rows } = await pool.query<MappingRow>(
    `INSERT INTO employee_beat_mapping (employee_id, beat_id, day_of_week)
     VALUES ($1, $2, $3)
     ON CONFLICT (employee_id, beat_id)
       DO UPDATE SET is_active = true, deactivated_at = NULL, day_of_week = EXCLUDED.day_of_week, updated_at = now()
     RETURNING id, is_active, deactivated_at`,
    [employeeId, beatId, dayOfWeek]
  );
  return rows[0];
}

export async function unmapEmployeeBeat(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE employee_beat_mapping SET is_active = false, deactivated_at = now(), updated_at = now()
     WHERE id = $1 AND is_active = true`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// employee_retailer_mapping
// ---------------------------------------------------------------------------

export async function mapEmployeeRetailer(employeeId: string, retailerId: string): Promise<MappingRow> {
  const { rows } = await pool.query<MappingRow>(
    `INSERT INTO employee_retailer_mapping (employee_id, retailer_id)
     VALUES ($1, $2)
     ON CONFLICT (employee_id, retailer_id)
       DO UPDATE SET is_active = true, deactivated_at = NULL, updated_at = now()
     RETURNING id, is_active, deactivated_at`,
    [employeeId, retailerId]
  );
  return rows[0];
}

export async function unmapEmployeeRetailer(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE employee_retailer_mapping SET is_active = false, deactivated_at = now(), updated_at = now()
     WHERE id = $1 AND is_active = true`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// List-by-one-side lookups — what the admin UI needs to show "everything
// currently mapped to X" before picking one row to remove.
// ---------------------------------------------------------------------------

export async function listBeatsForDistributionPartner(distributionPartnerId: string) {
  const { rows } = await pool.query(
    `SELECT dpbm.id AS mapping_id, dpbm.is_active, b.id, b.code, b.name
     FROM distribution_partner_beat_mapping dpbm
     JOIN beats b ON b.id = dpbm.beat_id
     WHERE dpbm.distribution_partner_id = $1 AND dpbm.is_active = true
     ORDER BY b.name ASC`,
    [distributionPartnerId]
  );
  return rows;
}

export async function listRetailersForBeat(beatId: string) {
  const { rows } = await pool.query(
    `SELECT brm.id AS mapping_id, brm.is_active, brm.sequence_no, r.id, r.code, r.name
     FROM beat_retailer_mapping brm
     JOIN retailers r ON r.id = brm.retailer_id
     WHERE brm.beat_id = $1 AND brm.is_active = true
     ORDER BY brm.sequence_no ASC`,
    [beatId]
  );
  return rows;
}

export async function listDistributionPartnersForRetailer(retailerId: string) {
  const { rows } = await pool.query(
    `SELECT rdpm.id AS mapping_id, rdpm.is_active, dp.id, dp.code, dp.name, dp.partner_type
     FROM retailer_distribution_partner_mapping rdpm
     JOIN distribution_partners dp ON dp.id = rdpm.distribution_partner_id
     WHERE rdpm.retailer_id = $1 AND rdpm.is_active = true
     ORDER BY dp.name ASC`,
    [retailerId]
  );
  return rows;
}

export async function listDistributionPartnersForEmployee(employeeId: string) {
  const { rows } = await pool.query(
    `SELECT edpm.id AS mapping_id, edpm.is_active, dp.id, dp.code, dp.name, dp.partner_type
     FROM employee_distribution_partner_mapping edpm
     JOIN distribution_partners dp ON dp.id = edpm.distribution_partner_id
     WHERE edpm.employee_id = $1 AND edpm.is_active = true
     ORDER BY dp.name ASC`,
    [employeeId]
  );
  return rows;
}

export async function listBeatsForEmployee(employeeId: string) {
  const { rows } = await pool.query(
    `SELECT ebm.id AS mapping_id, ebm.is_active, ebm.day_of_week, b.id, b.code, b.name
     FROM employee_beat_mapping ebm
     JOIN beats b ON b.id = ebm.beat_id
     WHERE ebm.employee_id = $1 AND ebm.is_active = true
     ORDER BY b.name ASC`,
    [employeeId]
  );
  return rows;
}

export async function listRetailersForEmployee(employeeId: string) {
  const { rows } = await pool.query(
    `SELECT erm.id AS mapping_id, erm.is_active, r.id, r.code, r.name
     FROM employee_retailer_mapping erm
     JOIN retailers r ON r.id = erm.retailer_id
     WHERE erm.employee_id = $1 AND erm.is_active = true
     ORDER BY r.name ASC`,
    [employeeId]
  );
  return rows;
}
