-- Flowmint SFA MVP — initial schema
-- Mirrors SFA_MVP_Scope_Locked.md §5. Plain SQL (node-pg-migrate) instead of
-- Prisma migrate — see DECISIONS.md 2026-08-18: binaries.prisma.sh is
-- blocked in the build sandbox, so the persistence layer moved to
-- pg + node-pg-migrate. No business-rule or schema-shape change.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fast ILIKE/fuzzy search over 2,500 SKUs

-- ---------------------------------------------------------------------------
-- Placeholder tenancy tables
-- ---------------------------------------------------------------------------

CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE distributors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id),
  name         TEXT NOT NULL,
  code         TEXT NOT NULL UNIQUE,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Employees (users+employees collapsed for the prototype — see DECISIONS.md)
-- ---------------------------------------------------------------------------

CREATE TABLE employees (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id),
  distributor_id         UUID REFERENCES distributors(id),
  employee_code          TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  phone                  TEXT NOT NULL,
  role                   TEXT NOT NULL DEFAULT 'SALESMAN' CHECK (role IN ('SALESMAN')),
  password_hash          TEXT NOT NULL,
  failed_login_attempts  INT NOT NULL DEFAULT 0,
  locked_until           TIMESTAMPTZ,
  last_login_at          TIMESTAMPTZ,
  refresh_token_version  INT NOT NULL DEFAULT 0,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Retailers
-- ---------------------------------------------------------------------------

CREATE TABLE retailers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id),
  distributor_id         UUID NOT NULL REFERENCES distributors(id),
  code                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  owner_name             TEXT,
  address_line           TEXT,
  city                   TEXT,
  pincode                TEXT,
  phone                  TEXT,
  source                 TEXT NOT NULL DEFAULT 'FIELD' CHECK (source IN ('SEED', 'ADMIN', 'FIELD')),
  created_by_employee_id UUID REFERENCES employees(id),
  phone_verified_at      TIMESTAMPTZ,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Beats
-- ---------------------------------------------------------------------------

CREATE TABLE beats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  name           TEXT NOT NULL,
  code           TEXT NOT NULL UNIQUE,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE beat_retailer_mapping (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id      UUID NOT NULL REFERENCES beats(id),
  retailer_id  UUID NOT NULL REFERENCES retailers(id),
  sequence_no  INT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (beat_id, retailer_id)
);
CREATE INDEX idx_beat_retailer_mapping_beat_seq ON beat_retailer_mapping (beat_id, sequence_no);

-- day_of_week: 0=Sun ... 6=Sat
CREATE TABLE beat_employee_mapping (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id      UUID NOT NULL REFERENCES beats(id),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, day_of_week)
);
CREATE INDEX idx_beat_employee_mapping_emp_day ON beat_employee_mapping (employee_id, day_of_week);

-- ---------------------------------------------------------------------------
-- Catalog
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

-- ---------------------------------------------------------------------------
-- OTP (shared by outlet creation + password reset)
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
-- Visit log (NEW table — see SFA_MVP_Scope_Locked.md §5 rationale)
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
  latitude        NUMERIC(9,6), -- reserved, unused in v1
  longitude       NUMERIC(9,6), -- reserved, unused in v1
  client_uuid     UUID NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_beat_visit_log_emp_date ON beat_visit_log (employee_id, visit_date);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

CREATE TABLE sales_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number       TEXT NOT NULL UNIQUE,
  company_id         UUID NOT NULL REFERENCES companies(id),
  distributor_id     UUID NOT NULL REFERENCES distributors(id),
  employee_id        UUID NOT NULL REFERENCES employees(id),
  retailer_id        UUID NOT NULL REFERENCES retailers(id),
  beat_id            UUID REFERENCES beats(id),
  beat_visit_log_id  UUID UNIQUE REFERENCES beat_visit_log(id),
  order_date         DATE NOT NULL,
  status             TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'CANCELLED')),
  total_qty          INT NOT NULL,
  subtotal_amount    NUMERIC(14,2) NOT NULL,
  discount_pct       NUMERIC(5,2) NOT NULL,
  discount_amount    NUMERIC(14,2) NOT NULL,
  taxable_amount     NUMERIC(14,2) NOT NULL,
  gst_amount         NUMERIC(14,2) NOT NULL,
  grand_total_amount NUMERIC(14,2) NOT NULL,
  cancelled_at       TIMESTAMPTZ,
  client_uuid        UUID NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_orders_emp_date ON sales_orders (employee_id, order_date);
CREATE INDEX idx_sales_orders_retailer_date ON sales_orders (retailer_id, order_date);

CREATE TABLE sales_order_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id         UUID NOT NULL REFERENCES sales_orders(id),
  product_id             UUID NOT NULL REFERENCES products(id),
  sku_code_snapshot      TEXT NOT NULL,
  product_name_snapshot  TEXT NOT NULL,
  pack_size_snapshot     TEXT NOT NULL,
  uom_snapshot           TEXT NOT NULL,
  unit_price             NUMERIC(12,2) NOT NULL,
  quantity               INT NOT NULL,
  line_amount            NUMERIC(14,2) NOT NULL,
  line_discount_amount   NUMERIC(14,2) NOT NULL,
  gst_rate_snapshot      NUMERIC(5,2) NOT NULL,
  line_gst_amount        NUMERIC(14,2) NOT NULL,
  line_total             NUMERIC(14,2) NOT NULL
);
