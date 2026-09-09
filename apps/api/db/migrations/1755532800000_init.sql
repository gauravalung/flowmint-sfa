-- Flowmint — Phase 1 schema
-- Mirrors claude/Flowmint_Phase1_Scope_Locked.md.
--
-- This REPLACES the original MVP init migration wholesale rather than
-- layering ALTER TABLEs on top of it. That's a deliberate choice, not an
-- oversight: nothing has been deployed anywhere beyond local/dev sandboxes
-- (single pilot salesman, no production data), and the schema shape itself
-- is being redesigned (single distributor_id FKs -> many-to-many mapping
-- tables), so a chain of incremental ALTERs against a shape that's being
-- conceptually replaced would be harder to read than the actual target
-- schema. See DECISIONS.md 2026-09-09.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fast ILIKE/fuzzy search over 2,500 SKUs

-- ---------------------------------------------------------------------------
-- Tenancy placeholder (unchanged from the MVP — hardcoded to one seeded row,
-- columns present so multi-company is additive later, not a rebuild)
-- ---------------------------------------------------------------------------

CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Distribution partners: Super Distributor / Direct Distributor /
-- Sub Distributor as one table with a type discriminator (see spec §2.1).
-- ---------------------------------------------------------------------------

CREATE TABLE distribution_partners (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id),
  partner_type       TEXT NOT NULL CHECK (partner_type IN ('SUPER_DISTRIBUTOR', 'DIRECT_DISTRIBUTOR', 'SUB_DISTRIBUTOR')),
  -- Set only for SUB_DISTRIBUTOR, pointing at its parent SUPER_DISTRIBUTOR.
  -- "parent must itself be a SUPER_DISTRIBUTOR" and "only SUB_DISTRIBUTOR
  -- rows may have a parent" are enforced in the service layer (a CHECK
  -- constraint can't see a sibling row's partner_type) — see
  -- distributionPartnerService.ts.
  parent_partner_id  UUID REFERENCES distribution_partners(id),
  code               TEXT NOT NULL UNIQUE, -- admin-assigned for Super/Direct; system-generated SUBnnnn for Sub (see sub_distributor_code_seq below)
  name               TEXT NOT NULL,
  contact_name       TEXT,
  contact_phone      TEXT,
  address_line       TEXT,
  city               TEXT,
  pincode            TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_distribution_partners_type ON distribution_partners (partner_type);
CREATE INDEX idx_distribution_partners_parent ON distribution_partners (parent_partner_id);

-- Never reused even after a Sub Distributor is deactivated — a Postgres
-- SEQUENCE only moves forward, so this is the "never reused" guarantee
-- without extra bookkeeping. Formatted as SUB<n> by the application.
CREATE SEQUENCE sub_distributor_code_seq START WITH 5001 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- Employees — all roles (field + admin) in one table, hierarchy via
-- self-referential reporting_manager_id (spec §2.2).
-- ---------------------------------------------------------------------------

CREATE TABLE employees (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id),
  employee_code          TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  phone                  TEXT NOT NULL,
  role                   TEXT NOT NULL CHECK (role IN ('SALES_OFFICER', 'ISR', 'ASE', 'ASM', 'RSM', 'COUNTRY_HEAD', 'ADMIN')),
  reporting_manager_id   UUID REFERENCES employees(id),
  face_reference_photo_url TEXT, -- reserved for face-recognition login (spec §8.1); not wired to login yet
  password_hash          TEXT NOT NULL,
  failed_login_attempts  INT NOT NULL DEFAULT 0,
  locked_until           TIMESTAMPTZ,
  last_login_at          TIMESTAMPTZ,
  refresh_token_version  INT NOT NULL DEFAULT 0,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_reporting_manager ON employees (reporting_manager_id);
CREATE INDEX idx_employees_role ON employees (role);

-- ---------------------------------------------------------------------------
-- Retailer classification + retailers
-- ---------------------------------------------------------------------------

CREATE TABLE retailer_subcategories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Never reused even after a retailer is deactivated — same sequence
-- guarantee as sub-distributor codes. Formatted as RET<n> by the application.
CREATE SEQUENCE retailer_code_seq START WITH 50001 INCREMENT BY 1;

CREATE TABLE retailers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id),
  code                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  owner_name             TEXT,
  category               TEXT NOT NULL CHECK (category IN ('RETAIL', 'WHOLESALE')),
  subcategory_id         UUID REFERENCES retailer_subcategories(id),
  address_line           TEXT,
  city                   TEXT,
  pincode                TEXT,
  phone                  TEXT,
  latitude               NUMERIC(9,6),
  longitude              NUMERIC(9,6),
  source                 TEXT NOT NULL DEFAULT 'FIELD' CHECK (source IN ('SEED', 'ADMIN', 'FIELD', 'BULK')),
  created_by_employee_id UUID REFERENCES employees(id),
  phone_verified_at      TIMESTAMPTZ,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_retailers_name ON retailers (name);
CREATE INDEX idx_retailers_subcategory ON retailers (subcategory_id);

-- ---------------------------------------------------------------------------
-- Beats
-- ---------------------------------------------------------------------------

CREATE TABLE beats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Mapping tables (spec §6). Every relationship is its own table so removing
-- one mapping never touches another. Soft-deleted (is_active=false,
-- deactivated_at set) rather than hard-deleted, so history survives.
-- ---------------------------------------------------------------------------

CREATE TABLE distribution_partner_beat_mapping (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_partner_id UUID NOT NULL REFERENCES distribution_partners(id),
  beat_id               UUID NOT NULL REFERENCES beats(id),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  deactivated_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (distribution_partner_id, beat_id)
);

CREATE TABLE beat_retailer_mapping (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id      UUID NOT NULL REFERENCES beats(id),
  retailer_id  UUID NOT NULL REFERENCES retailers(id),
  sequence_no  INT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (beat_id, retailer_id)
);
CREATE INDEX idx_beat_retailer_mapping_beat_seq ON beat_retailer_mapping (beat_id, sequence_no);
-- Backs the 40-outlet cap check (count of active rows per beat) — see spec §7.
CREATE INDEX idx_beat_retailer_mapping_active_beat ON beat_retailer_mapping (beat_id) WHERE is_active = true;

CREATE TABLE retailer_distribution_partner_mapping (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id              UUID NOT NULL REFERENCES retailers(id),
  distribution_partner_id  UUID NOT NULL REFERENCES distribution_partners(id),
  is_active                BOOLEAN NOT NULL DEFAULT true,
  deactivated_at           TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, distribution_partner_id)
);

CREATE TABLE employee_distribution_partner_mapping (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id              UUID NOT NULL REFERENCES employees(id),
  distribution_partner_id  UUID NOT NULL REFERENCES distribution_partners(id),
  is_active                BOOLEAN NOT NULL DEFAULT true,
  deactivated_at           TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, distribution_partner_id)
);

CREATE TABLE employee_beat_mapping (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES employees(id),
  beat_id        UUID NOT NULL REFERENCES beats(id),
  -- MVP-era fallback: which weekday this beat defaults to for "today's
  -- beat" resolution, until the real PJP API (spec §8.2, deferred this
  -- slice) takes over as the authoritative daily assignment. Nullable —
  -- a mapping can authorize a salesman on a beat with no fixed day.
  day_of_week    SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, beat_id)
);
-- At most one active default-day beat per employee per weekday.
CREATE UNIQUE INDEX idx_employee_beat_mapping_active_day ON employee_beat_mapping (employee_id, day_of_week)
  WHERE is_active = true AND day_of_week IS NOT NULL;

CREATE TABLE employee_retailer_mapping (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES employees(id),
  retailer_id    UUID NOT NULL REFERENCES retailers(id),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, retailer_id)
);

-- ---------------------------------------------------------------------------
-- Status-change audit (spec §4) — one generic table for both entity types
-- that carry Active/Inactive tracking today; extensible to more later.
-- ---------------------------------------------------------------------------

CREATE TABLE status_change_log (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type            TEXT NOT NULL CHECK (entity_type IN ('DISTRIBUTION_PARTNER', 'RETAILER')),
  entity_id              UUID NOT NULL,
  previous_status        BOOLEAN NOT NULL,
  new_status             BOOLEAN NOT NULL,
  changed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by_employee_id UUID REFERENCES employees(id),
  reason                 TEXT
);
CREATE INDEX idx_status_change_log_entity ON status_change_log (entity_type, entity_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- Catalog (brands/categories unchanged from the MVP; products stays one
-- shared company-wide catalog — per-distributor stock/focus is an overlay,
-- spec §8.6)
-- ---------------------------------------------------------------------------

CREATE TABLE brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id),
  brand_id    UUID NOT NULL REFERENCES brands(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  sku_code    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  pack_size   TEXT NOT NULL,
  uom         TEXT NOT NULL DEFAULT 'PCS',
  mrp         NUMERIC(12,2) NOT NULL,
  price       NUMERIC(12,2) NOT NULL,
  gst_rate    NUMERIC(5,2) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_name ON products (name);
CREATE INDEX idx_products_sku_trgm ON products USING gin (sku_code gin_trgm_ops);

CREATE TABLE distribution_partner_product_inventory (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_partner_id  UUID NOT NULL REFERENCES distribution_partners(id),
  product_id               UUID NOT NULL REFERENCES products(id),
  available_qty            INT NOT NULL DEFAULT 0,
  is_focus_product         BOOLEAN NOT NULL DEFAULT false,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (distribution_partner_id, product_id)
);
CREATE INDEX idx_dp_inventory_partner ON distribution_partner_product_inventory (distribution_partner_id);

-- ---------------------------------------------------------------------------
-- OTP (shared by outlet creation + password reset — unchanged from the MVP)
-- ---------------------------------------------------------------------------

CREATE TABLE otp_verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT NOT NULL,
  purpose       TEXT NOT NULL CHECK (purpose IN ('RETAILER_CREATION', 'PASSWORD_RESET')),
  otp_hash      TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  verified_at   TIMESTAMPTZ,
  employee_id   UUID REFERENCES employees(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_phone_purpose_created ON otp_verifications (phone, purpose, created_at DESC);

-- ---------------------------------------------------------------------------
-- Face recognition at login (spec §8.1) — data model + provider record only;
-- not yet wired into the login flow.
-- ---------------------------------------------------------------------------

CREATE TABLE login_face_verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_match      BOOLEAN NOT NULL,
  match_score   NUMERIC(5,2),
  provider      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_face_verifications_employee ON login_face_verifications (employee_id, attempted_at DESC);

-- ---------------------------------------------------------------------------
-- PJP (Permanent Journey Plan) — spec §8.2
-- ---------------------------------------------------------------------------

CREATE TABLE pjp_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id              UUID NOT NULL REFERENCES employees(id),
  plan_date                DATE NOT NULL,
  beat_id                  UUID REFERENCES beats(id),
  is_weekly_off            BOOLEAN NOT NULL DEFAULT false,
  status                   TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  submitted_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by_employee_id  UUID REFERENCES employees(id),
  reviewed_at              TIMESTAMPTZ,
  review_note              TEXT,
  supersedes_pjp_entry_id  UUID REFERENCES pjp_entries(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (beat_id IS NOT NULL OR is_weekly_off = true)
);
-- Only one live (pending/approved) plan per employee per date — a revision
-- must supersede the old row, not coexist with it.
CREATE UNIQUE INDEX idx_pjp_one_live_per_date ON pjp_entries (employee_id, plan_date)
  WHERE status IN ('PENDING_APPROVAL', 'APPROVED');
CREATE INDEX idx_pjp_employee_date ON pjp_entries (employee_id, plan_date);

-- ---------------------------------------------------------------------------
-- GPS-verified working-hours day start (spec §8.3)
-- ---------------------------------------------------------------------------

CREATE TABLE work_day_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES employees(id),
  work_date           DATE NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL,
  start_latitude      NUMERIC(9,6) NOT NULL,
  start_longitude     NUMERIC(9,6) NOT NULL,
  verified_retailer_id UUID REFERENCES retailers(id),
  ended_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

-- ---------------------------------------------------------------------------
-- Visit log (unchanged shape from the MVP)
-- ---------------------------------------------------------------------------

CREATE TABLE beat_visit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  retailer_id     UUID NOT NULL REFERENCES retailers(id),
  beat_id         UUID REFERENCES beats(id),
  visit_date      DATE NOT NULL,
  check_in_at     TIMESTAMPTZ NOT NULL,
  check_out_at    TIMESTAMPTZ,
  outcome         TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (outcome IN ('IN_PROGRESS', 'ORDER_BOOKED', 'NO_ORDER')),
  no_order_reason TEXT CHECK (no_order_reason IN ('SHOP_CLOSED', 'OWNER_ABSENT', 'SUFFICIENT_STOCK', 'CREDIT_ISSUE', 'PRICE_ISSUE', 'OTHER')),
  is_off_beat     BOOLEAN NOT NULL DEFAULT false,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  client_uuid     UUID NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_beat_visit_log_emp_date ON beat_visit_log (employee_id, visit_date);

-- ---------------------------------------------------------------------------
-- Orders — scheme v2: tentative (at booking) + final (at delivery),
-- spec §9. Supersedes the MVP's single-stage discount fields.
-- ---------------------------------------------------------------------------

CREATE TABLE sales_orders (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number                  TEXT NOT NULL UNIQUE,
  company_id                    UUID NOT NULL REFERENCES companies(id),
  distribution_partner_id       UUID NOT NULL REFERENCES distribution_partners(id),
  employee_id                   UUID NOT NULL REFERENCES employees(id),
  retailer_id                   UUID NOT NULL REFERENCES retailers(id),
  beat_id                       UUID REFERENCES beats(id),
  beat_visit_log_id             UUID UNIQUE REFERENCES beat_visit_log(id),
  order_date                    DATE NOT NULL,
  status                        TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'SAVED', 'CANCELLED', 'DELIVERED')),
  total_qty                     INT NOT NULL,

  -- Booked (tentative) figures — computed at submission from the booked cart.
  subtotal_amount                NUMERIC(14,2) NOT NULL, -- pretax, pre-discount, as booked
  tentative_discount_pct         NUMERIC(5,2) NOT NULL,
  tentative_discount_amount      NUMERIC(14,2) NOT NULL,
  tentative_taxable_amount       NUMERIC(14,2) NOT NULL,
  tentative_gst_amount           NUMERIC(14,2) NOT NULL,
  tentative_grand_total_amount   NUMERIC(14,2) NOT NULL,

  -- Final figures — set only on the DELIVERED transition, recalculated from
  -- the actual delivered subtotal (sum of sales_order_items.delivered_quantity,
  -- falling back to booked quantity where not overridden). NULL until then.
  delivered_subtotal_amount      NUMERIC(14,2),
  final_discount_pct             NUMERIC(5,2),
  final_discount_amount          NUMERIC(14,2),
  final_taxable_amount           NUMERIC(14,2),
  final_gst_amount               NUMERIC(14,2),
  final_grand_total_amount       NUMERIC(14,2),

  cancelled_at        TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  client_uuid          UUID NOT NULL UNIQUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_orders_emp_date ON sales_orders (employee_id, order_date);
CREATE INDEX idx_sales_orders_retailer_date ON sales_orders (retailer_id, order_date);

CREATE TABLE sales_order_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id              UUID NOT NULL REFERENCES sales_orders(id),
  product_id                  UUID NOT NULL REFERENCES products(id),
  sku_code_snapshot           TEXT NOT NULL,
  product_name_snapshot       TEXT NOT NULL,
  pack_size_snapshot          TEXT NOT NULL,
  uom_snapshot                TEXT NOT NULL,
  unit_price                  NUMERIC(12,2) NOT NULL,
  quantity                    INT NOT NULL, -- booked quantity
  delivered_quantity          INT, -- NULL until delivery; NULL is treated as "same as booked"
  line_amount                 NUMERIC(14,2) NOT NULL, -- booked pretax
  gst_rate_snapshot           NUMERIC(5,2) NOT NULL,
  tentative_line_discount_amount NUMERIC(14,2) NOT NULL,
  tentative_line_gst_amount      NUMERIC(14,2) NOT NULL,
  tentative_line_total           NUMERIC(14,2) NOT NULL,
  final_line_discount_amount     NUMERIC(14,2),
  final_line_gst_amount          NUMERIC(14,2),
  final_line_total               NUMERIC(14,2)
);

-- ---------------------------------------------------------------------------
-- System settings — small admin-toggleable key/value store (spec §8.5, §10)
-- ---------------------------------------------------------------------------

CREATE TABLE system_settings (
  key                    TEXT PRIMARY KEY,
  value                  JSONB NOT NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_employee_id UUID REFERENCES employees(id)
);

-- ---------------------------------------------------------------------------
-- Bulk upload (spec §11)
-- ---------------------------------------------------------------------------

CREATE TABLE bulk_upload_jobs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_type            TEXT NOT NULL CHECK (upload_type IN ('RETAILER', 'PRODUCT', 'BEAT_RETAILER_MAPPING', 'EMPLOYEE')),
  uploaded_by_employee_id UUID NOT NULL REFERENCES employees(id),
  filename               TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  total_rows             INT NOT NULL DEFAULT 0,
  success_rows           INT NOT NULL DEFAULT 0,
  failed_rows            INT NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at           TIMESTAMPTZ
);

CREATE TABLE bulk_upload_row_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES bulk_upload_jobs(id),
  row_number    INT NOT NULL,
  error_message TEXT NOT NULL,
  raw_row_json  JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bulk_upload_row_errors_job ON bulk_upload_row_errors (job_id);

-- ---------------------------------------------------------------------------
-- Reference data seeds (admin-editable afterwards — placeholders, not
-- hardcoded business rules; see spec §5 and §12 on the deferred real list)
-- ---------------------------------------------------------------------------

INSERT INTO retailer_subcategories (name) VALUES
  ('General Store'), ('Grocery Store'), ('Departmental Store')
ON CONFLICT (name) DO NOTHING;

INSERT INTO system_settings (key, value) VALUES
  ('otp_mandatory_for_outlet_creation', 'true'),
  ('dashboard_order_value_basis', '"MRP"'),
  ('gps_verification_radius_meters', '200')
ON CONFLICT (key) DO NOTHING;
