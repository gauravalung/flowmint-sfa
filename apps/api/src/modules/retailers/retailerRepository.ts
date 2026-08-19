import { pool } from "../../db/pool";

export interface RetailerRow {
  id: string;
  company_id: string;
  distributor_id: string;
  code: string;
  name: string;
  owner_name: string | null;
  address_line: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  source: "SEED" | "ADMIN" | "FIELD";
  created_by_employee_id: string | null;
  phone_verified_at: Date | null;
  is_active: boolean;
}

export async function findById(id: string): Promise<RetailerRow | null> {
  const { rows } = await pool.query<RetailerRow>(
    `SELECT * FROM retailers WHERE id = $1 AND is_active = true`,
    [id]
  );
  return rows[0] ?? null;
}

// Off-beat search: scoped to the salesman's own distributor — never lets one
// distributor's salesman browse another distributor's retailer book.
export async function searchRetailers(
  distributorId: string,
  search: string,
  page: number,
  pageSize: number
): Promise<{ rows: RetailerRow[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const likeTerm = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const { rows } = await pool.query<RetailerRow>(
    `SELECT * FROM retailers
     WHERE distributor_id = $1 AND is_active = true
       AND ($2 = '' OR name ILIKE $3 OR code ILIKE $3)
     ORDER BY name ASC
     LIMIT $4 OFFSET $5`,
    [distributorId, search, likeTerm, pageSize, offset]
  );
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM retailers
     WHERE distributor_id = $1 AND is_active = true
       AND ($2 = '' OR name ILIKE $3 OR code ILIKE $3)`,
    [distributorId, search, likeTerm]
  );
  return { rows, total: Number(countRows[0].count) };
}

export async function findActiveByPhone(phone: string): Promise<RetailerRow | null> {
  const { rows } = await pool.query<RetailerRow>(
    `SELECT * FROM retailers WHERE phone = $1 AND is_active = true LIMIT 1`,
    [phone]
  );
  return rows[0] ?? null;
}

function generateRetailerCode(): string {
  // FIELD-created outlets get a distinct code namespace from SEED/ADMIN rows
  // (RTL-xxx), so it's obvious at a glance in any report which retailers
  // were self-registered by a salesman versus set up centrally.
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FLD-${suffix}`;
}

export async function createRetailer(params: {
  companyId: string;
  distributorId: string;
  name: string;
  ownerName: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  phone: string;
  createdByEmployeeId: string;
}): Promise<RetailerRow> {
  const { rows } = await pool.query<RetailerRow>(
    `INSERT INTO retailers
       (company_id, distributor_id, code, name, owner_name, address_line, city, pincode, phone,
        source, created_by_employee_id, phone_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'FIELD', $10, now())
     RETURNING *`,
    [
      params.companyId,
      params.distributorId,
      generateRetailerCode(),
      params.name,
      params.ownerName,
      params.addressLine,
      params.city,
      params.pincode,
      params.phone,
      params.createdByEmployeeId,
    ]
  );
  return rows[0];
}
