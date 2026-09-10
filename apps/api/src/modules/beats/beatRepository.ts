import { pool } from "../../db/pool";

export interface BeatRow {
  id: string;
  company_id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface BeatRetailerRow {
  sequence_no: number;
  id: string;
  code: string;
  name: string;
  owner_name: string | null;
  category: string;
  subcategory_id: string | null;
  subcategory_name: string | null;
  address_line: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  latitude: string | null;
  longitude: string | null;
  is_active: boolean;
}

export async function findById(id: string): Promise<BeatRow | null> {
  const { rows } = await pool.query<BeatRow>(`SELECT * FROM beats WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findByCode(code: string): Promise<BeatRow | null> {
  const { rows } = await pool.query<BeatRow>(`SELECT * FROM beats WHERE code = $1`, [code]);
  return rows[0] ?? null;
}

export async function list(isActive?: boolean): Promise<BeatRow[]> {
  if (isActive === undefined) {
    const { rows } = await pool.query<BeatRow>(`SELECT * FROM beats ORDER BY name ASC`);
    return rows;
  }
  const { rows } = await pool.query<BeatRow>(`SELECT * FROM beats WHERE is_active = $1 ORDER BY name ASC`, [
    isActive,
  ]);
  return rows;
}

export async function create(params: { companyId: string; name: string; code: string }): Promise<BeatRow> {
  const { rows } = await pool.query<BeatRow>(
    `INSERT INTO beats (company_id, name, code) VALUES ($1, $2, $3) RETURNING *`,
    [params.companyId, params.name, params.code]
  );
  return rows[0];
}

export async function setStatus(id: string, isActive: boolean): Promise<BeatRow | null> {
  const { rows } = await pool.query<BeatRow>(
    `UPDATE beats SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, isActive]
  );
  return rows[0] ?? null;
}

// "Today's beat" — MVP-era fallback via employee_beat_mapping.day_of_week
// until the real PJP API (spec §8.2, deferred this slice) is built and
// becomes authoritative for the daily assignment.
export async function findTodayBeatForEmployee(employeeId: string, dayOfWeek: number): Promise<BeatRow | null> {
  const { rows } = await pool.query<BeatRow>(
    `SELECT b.* FROM employee_beat_mapping ebm
     JOIN beats b ON b.id = ebm.beat_id AND b.is_active = true
     WHERE ebm.employee_id = $1 AND ebm.day_of_week = $2 AND ebm.is_active = true
     LIMIT 1`,
    [employeeId, dayOfWeek]
  );
  return rows[0] ?? null;
}

export async function findBeatRetailers(beatId: string): Promise<BeatRetailerRow[]> {
  const { rows } = await pool.query<BeatRetailerRow>(
    `SELECT brm.sequence_no, r.id, r.code, r.name, r.owner_name, r.category, r.subcategory_id, sc.name AS subcategory_name,
            r.address_line, r.city, r.pincode, r.phone, r.latitude, r.longitude, r.is_active
     FROM beat_retailer_mapping brm
     JOIN retailers r ON r.id = brm.retailer_id AND r.is_active = true
     LEFT JOIN retailer_subcategories sc ON sc.id = r.subcategory_id
     WHERE brm.beat_id = $1 AND brm.is_active = true
     ORDER BY brm.sequence_no ASC`,
    [beatId]
  );
  return rows;
}

// Mobile navigation, spec §8.4: Distributor list -> Beat list -> Retailer
// list, each scoped to the logged-in employee via the mapping tables.

export interface DistributorForEmployeeRow {
  id: string;
  code: string;
  name: string;
  partner_type: string;
}

export async function findDistributorsForEmployee(employeeId: string): Promise<DistributorForEmployeeRow[]> {
  const { rows } = await pool.query<DistributorForEmployeeRow>(
    `SELECT dp.id, dp.code, dp.name, dp.partner_type
     FROM employee_distribution_partner_mapping edpm
     JOIN distribution_partners dp ON dp.id = edpm.distribution_partner_id AND dp.is_active = true
     WHERE edpm.employee_id = $1 AND edpm.is_active = true
     ORDER BY dp.name ASC`,
    [employeeId]
  );
  return rows;
}

export async function findBeatsForDistributorAndEmployee(
  distributionPartnerId: string,
  employeeId: string
): Promise<BeatRow[]> {
  const { rows } = await pool.query<BeatRow>(
    `SELECT b.* FROM distribution_partner_beat_mapping dpbm
     JOIN beats b ON b.id = dpbm.beat_id AND b.is_active = true
     WHERE dpbm.distribution_partner_id = $1 AND dpbm.is_active = true
       AND EXISTS (
         SELECT 1 FROM employee_beat_mapping ebm
         WHERE ebm.beat_id = b.id AND ebm.employee_id = $2 AND ebm.is_active = true
       )
     ORDER BY b.name ASC`,
    [distributionPartnerId, employeeId]
  );
  return rows;
}
