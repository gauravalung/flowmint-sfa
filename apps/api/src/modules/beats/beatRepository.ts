import { pool } from "../../db/pool";

export interface BeatRow {
  id: string;
  name: string;
  code: string;
  distributor_id: string;
}

export interface BeatRetailerRow {
  sequence_no: number;
  id: string;
  code: string;
  name: string;
  owner_name: string | null;
  address_line: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
}

export async function findTodayBeatForEmployee(
  employeeId: string,
  dayOfWeek: number
): Promise<BeatRow | null> {
  const { rows } = await pool.query<BeatRow>(
    `SELECT b.id, b.name, b.code, b.distributor_id
     FROM beat_employee_mapping bem
     JOIN beats b ON b.id = bem.beat_id AND b.is_active = true
     WHERE bem.employee_id = $1 AND bem.day_of_week = $2 AND bem.is_active = true
     LIMIT 1`,
    [employeeId, dayOfWeek]
  );
  return rows[0] ?? null;
}

export async function findById(beatId: string): Promise<BeatRow | null> {
  const { rows } = await pool.query<BeatRow>(
    `SELECT id, name, code, distributor_id FROM beats WHERE id = $1 AND is_active = true`,
    [beatId]
  );
  return rows[0] ?? null;
}

// The "browse all beats" list for one distributor — every active beat under
// it, not just the ones this employee has a day_of_week mapping for.
// Deliberately as broad as distributor access itself (same precedent as
// off-beat retailer search, which already shows the whole distributor's
// retailer book, not just beat-assigned ones) — access is checked one
// level up, by distributorService.requireDistributorAccess, not here.
export async function findBeatsForDistributor(distributorId: string): Promise<BeatRow[]> {
  const { rows } = await pool.query<BeatRow>(
    `SELECT id, name, code, distributor_id FROM beats WHERE distributor_id = $1 AND is_active = true ORDER BY name ASC`,
    [distributorId]
  );
  return rows;
}

export async function findBeatRetailers(beatId: string): Promise<BeatRetailerRow[]> {
  const { rows } = await pool.query<BeatRetailerRow>(
    `SELECT brm.sequence_no, r.id, r.code, r.name, r.owner_name, r.address_line, r.city, r.pincode, r.phone
     FROM beat_retailer_mapping brm
     JOIN retailers r ON r.id = brm.retailer_id AND r.is_active = true
     WHERE brm.beat_id = $1 AND brm.is_active = true
     ORDER BY brm.sequence_no ASC`,
    [beatId]
  );
  return rows;
}
