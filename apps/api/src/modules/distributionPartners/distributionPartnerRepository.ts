import { pool } from "../../db/pool";
import type { DistributionPartnerType } from "@flowmint/shared";

export interface DistributionPartnerRow {
  id: string;
  company_id: string;
  partner_type: DistributionPartnerType;
  parent_partner_id: string | null;
  code: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  address_line: string | null;
  city: string | null;
  pincode: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function findById(id: string): Promise<DistributionPartnerRow | null> {
  const { rows } = await pool.query<DistributionPartnerRow>(
    `SELECT * FROM distribution_partners WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findByCode(code: string): Promise<DistributionPartnerRow | null> {
  const { rows } = await pool.query<DistributionPartnerRow>(
    `SELECT * FROM distribution_partners WHERE code = $1`,
    [code]
  );
  return rows[0] ?? null;
}

export async function list(filter: {
  partnerType?: DistributionPartnerType;
  isActive?: boolean;
}): Promise<DistributionPartnerRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.partnerType) {
    params.push(filter.partnerType);
    conditions.push(`partner_type = $${params.length}`);
  }
  if (filter.isActive !== undefined) {
    params.push(filter.isActive);
    conditions.push(`is_active = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query<DistributionPartnerRow>(
    `SELECT * FROM distribution_partners ${where} ORDER BY name ASC`,
    params
  );
  return rows;
}

// System-generated, strictly sequential, never reused (spec §3) — backed by
// a real Postgres SEQUENCE so "never reused even after deactivation" holds
// without extra bookkeeping.
async function nextSubDistributorCode(): Promise<string> {
  const { rows } = await pool.query<{ next: string }>(`SELECT nextval('sub_distributor_code_seq') AS next`);
  return `SUB${rows[0].next}`;
}

export async function create(params: {
  companyId: string;
  partnerType: DistributionPartnerType;
  code: string | null; // null for SUB_DISTRIBUTOR -> system-generated
  parentPartnerId: string | null;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
}): Promise<DistributionPartnerRow> {
  const code = params.partnerType === "SUB_DISTRIBUTOR" ? await nextSubDistributorCode() : params.code;
  const { rows } = await pool.query<DistributionPartnerRow>(
    `INSERT INTO distribution_partners
       (company_id, partner_type, parent_partner_id, code, name, contact_name, contact_phone, address_line, city, pincode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.companyId,
      params.partnerType,
      params.parentPartnerId,
      code,
      params.name,
      params.contactName,
      params.contactPhone,
      params.addressLine,
      params.city,
      params.pincode,
    ]
  );
  return rows[0];
}

export async function setStatus(id: string, isActive: boolean): Promise<DistributionPartnerRow | null> {
  const { rows } = await pool.query<DistributionPartnerRow>(
    `UPDATE distribution_partners SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, isActive]
  );
  return rows[0] ?? null;
}
