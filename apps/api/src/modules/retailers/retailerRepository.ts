import { pool } from "../../db/pool";
import type { RetailerCategory, RetailerSource } from "@flowmint/shared";

export interface RetailerRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  owner_name: string | null;
  category: RetailerCategory;
  subcategory_id: string | null;
  address_line: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  latitude: string | null;
  longitude: string | null;
  source: RetailerSource;
  created_by_employee_id: string | null;
  phone_verified_at: Date | null;
  is_active: boolean;
}

export interface RetailerRowWithSubcategory extends RetailerRow {
  subcategory_name: string | null;
}

const SELECT_WITH_SUBCATEGORY = `
  SELECT r.*, sc.name AS subcategory_name
  FROM retailers r
  LEFT JOIN retailer_subcategories sc ON sc.id = r.subcategory_id
`;

export async function findById(id: string): Promise<RetailerRowWithSubcategory | null> {
  const { rows } = await pool.query<RetailerRowWithSubcategory>(
    `${SELECT_WITH_SUBCATEGORY} WHERE r.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findByCode(code: string): Promise<RetailerRow | null> {
  const { rows } = await pool.query<RetailerRow>(`SELECT * FROM retailers WHERE code = $1`, [code]);
  return rows[0] ?? null;
}

export async function findActiveByPhone(phone: string): Promise<RetailerRow | null> {
  const { rows } = await pool.query<RetailerRow>(
    `SELECT * FROM retailers WHERE phone = $1 AND is_active = true LIMIT 1`,
    [phone]
  );
  return rows[0] ?? null;
}

// Off-beat search: scoped to distribution partners the employee is
// currently mapped to (their "working distributors") — the many-to-many
// analog of the MVP's single distributor_id scoping. Never lets one
// salesman browse a retailer book they have no distributor relationship to.
export async function searchRetailersForEmployee(
  employeeId: string,
  search: string,
  page: number,
  pageSize: number
): Promise<{ rows: RetailerRowWithSubcategory[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const likeTerm = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const { rows } = await pool.query<RetailerRowWithSubcategory>(
    `${SELECT_WITH_SUBCATEGORY}
     WHERE r.is_active = true
       AND EXISTS (
         SELECT 1 FROM retailer_distribution_partner_mapping rdpm
         JOIN employee_distribution_partner_mapping edpm
           ON edpm.distribution_partner_id = rdpm.distribution_partner_id AND edpm.is_active = true
         WHERE rdpm.retailer_id = r.id AND rdpm.is_active = true AND edpm.employee_id = $1
       )
       AND ($2 = '' OR r.name ILIKE $3 OR r.code ILIKE $3)
     ORDER BY r.name ASC
     LIMIT $4 OFFSET $5`,
    [employeeId, search, likeTerm, pageSize, offset]
  );
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM retailers r
     WHERE r.is_active = true
       AND EXISTS (
         SELECT 1 FROM retailer_distribution_partner_mapping rdpm
         JOIN employee_distribution_partner_mapping edpm
           ON edpm.distribution_partner_id = rdpm.distribution_partner_id AND edpm.is_active = true
         WHERE rdpm.retailer_id = r.id AND rdpm.is_active = true AND edpm.employee_id = $1
       )
       AND ($2 = '' OR r.name ILIKE $3 OR r.code ILIKE $3)`,
    [employeeId, search, likeTerm]
  );
  return { rows, total: Number(countRows[0].count) };
}

export async function list(filter: {
  isActive?: boolean;
  category?: RetailerCategory;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ rows: RetailerRowWithSubcategory[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.isActive !== undefined) {
    params.push(filter.isActive);
    conditions.push(`r.is_active = $${params.length}`);
  }
  if (filter.category) {
    params.push(filter.category);
    conditions.push(`r.category = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search.replace(/[%_]/g, (m) => `\\${m}`)}%`);
    conditions.push(`(r.name ILIKE $${params.length} OR r.code ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (filter.page - 1) * filter.pageSize;

  const { rows } = await pool.query<RetailerRowWithSubcategory>(
    `${SELECT_WITH_SUBCATEGORY} ${where} ORDER BY r.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filter.pageSize, offset]
  );
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM retailers r ${where}`,
    params
  );
  return { rows, total: Number(countRows[0].count) };
}

// System-generated, strictly sequential, never reused (spec §3).
async function nextRetailerCode(): Promise<string> {
  const { rows } = await pool.query<{ next: string }>(`SELECT nextval('retailer_code_seq') AS next`);
  return `RET${rows[0].next}`;
}

export async function createRetailer(params: {
  companyId: string;
  code: string | null; // null -> system-assigned
  name: string;
  ownerName: string | null;
  category: RetailerCategory;
  subcategoryId: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  source: RetailerSource;
  createdByEmployeeId: string | null;
  phoneVerified: boolean;
}): Promise<RetailerRow> {
  const code = params.code ?? (await nextRetailerCode());
  const { rows } = await pool.query<RetailerRow>(
    `INSERT INTO retailers
       (company_id, code, name, owner_name, category, subcategory_id, address_line, city, pincode, phone,
        source, created_by_employee_id, phone_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      params.companyId,
      code,
      params.name,
      params.ownerName,
      params.category,
      params.subcategoryId,
      params.addressLine,
      params.city,
      params.pincode,
      params.phone,
      params.source,
      params.createdByEmployeeId,
      params.phoneVerified ? new Date() : null,
    ]
  );
  return rows[0];
}

// True if this employee can reach the retailer through any relationship:
// direct employee<->retailer mapping, a beat they're mapped to that
// contains the retailer, or a distributor they're mapped to that the
// retailer is also mapped to (off-beat, spec §6). Used to scope visit
// start / order booking so one salesman can't act on a retailer they have
// no relationship to at all.
export async function isRetailerAccessibleToEmployee(employeeId: string, retailerId: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM employee_retailer_mapping erm
       WHERE erm.employee_id = $1 AND erm.retailer_id = $2 AND erm.is_active = true
       UNION ALL
       SELECT 1 FROM employee_beat_mapping ebm
       JOIN beat_retailer_mapping brm ON brm.beat_id = ebm.beat_id AND brm.is_active = true
       WHERE ebm.employee_id = $1 AND ebm.is_active = true AND brm.retailer_id = $2
       UNION ALL
       SELECT 1 FROM employee_distribution_partner_mapping edpm
       JOIN retailer_distribution_partner_mapping rdpm
         ON rdpm.distribution_partner_id = edpm.distribution_partner_id AND rdpm.is_active = true
       WHERE edpm.employee_id = $1 AND edpm.is_active = true AND rdpm.retailer_id = $2
     ) AS exists`,
    [employeeId, retailerId]
  );
  return rows[0]?.exists ?? false;
}

export async function setStatus(id: string, isActive: boolean): Promise<RetailerRow | null> {
  const { rows } = await pool.query<RetailerRow>(
    `UPDATE retailers SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, isActive]
  );
  return rows[0] ?? null;
}
