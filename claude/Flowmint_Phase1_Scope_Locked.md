# Flowmint SFA — Phase 1 Locked Scope & Technical Spec

**Status:** Approved for development 2026-09-09 ("take action" received). Supersedes
`SFA_MVP_Scope_Locked.md` for scope, schema, and scheme logic — see
`DECISIONS.md` 2026-09-09 for the supersession decision and why.
**Source material:** `VLCC Personal Care — Flowmint SFA Mobile App + Admin
Web Portal — Requirements Document — Phase 1 (Basic Scope)`, oral discovery
session with Cuni, VLCC Personal Care.

This is Phase 1 ("basic scope") of the full VLCC system: two connected
applications (Flowmint SFA mobile app + Flowmint Admin Web Portal) sharing
one database. Architecture is explicitly required to be extensible —
further enhancements layer on later without a rebuild.

---

## 0. Relationship to the prior MVP

The repo already contained a narrower "SFA MVP" (single pilot salesman,
single hardcoded company/distributor, no hierarchy, no admin portal — see
`SFA_MVP_Scope_Locked.md`, Slice A complete). That MVP was explicitly framed
as a stopgap "ahead of the full spec." This document **is** that full spec
(Phase 1 of it), confirmed by the user to supersede the MVP:

- **Schema**: the MVP's single `distributor_id` column on `employees` /
  `retailers` / `beats` is replaced by the many-to-many mapping model in §6
  below. Existing MVP tables are redesigned, not purely additive.
- **Scheme discount logic**: the MVP's hardcoded ₹2,500/₹5,000 → 0/2/5%
  single-stage rule is retired. Phase 1 uses the ₹5,000/₹10,000 → 0/5/10%
  slab with tentative (at booking) + final (at delivery) two-stage
  calculation — see §9.
- **Reused as-is where still correct**: password hashing/lockout, JWT
  access+refresh with `refresh_token_version` revocation, OTP adapter
  pattern (console/MSG91), route→controller→service→repository layering,
  `pg`+`node-pg-migrate` persistence (no Prisma — sandbox network policy,
  see `DECISIONS.md` 2026-08-18), generic JSON error envelope, enumeration-
  safe auth responses.

---

## 1. System Overview

1. **Flowmint SFA Mobile App** — field sales/ground team (Sales Officer /
   ISR / ASE) execute daily beat visits and book orders.
2. **Flowmint Admin Web Portal** — company admins manage all master data
   and mappings.

Both share the Phase 1 database designed below.

---

## 2. Organizational / Distribution Hierarchy

### 2.1 Distribution partner model

Super Distributor, Direct Distributor, and Sub Distributor are modeled as
**one table with a type discriminator** (`distribution_partners`,
`partner_type`), not three separate tables — a Sub Distributor differs from
a Super/Direct Distributor only in having a parent and a different billing
chain, and folding them together is what makes "further mapping types
later" additive instead of a schema fork.

| `partner_type` | Billed by | `parent_partner_id` |
|---|---|---|
| `SUPER_DISTRIBUTOR` | Company (direct) | NULL |
| `DIRECT_DISTRIBUTOR` | Company (direct) | NULL |
| `SUB_DISTRIBUTOR` | Its parent Super Distributor | the Super Distributor's `id` |

Billing-chain (§2.1 of the requirements doc) is *derived*, not stored
redundantly: `SUPER_DISTRIBUTOR`/`DIRECT_DISTRIBUTOR` → billed by company;
`SUB_DISTRIBUTOR` → billed by `parent_partner_id`. Retailers are billed by
whichever `distribution_partner` they're mapped to via
`retailer_distribution_partner_mapping` (§6) — a retailer can be mapped to
more than one, so "who bills this retailer" is a per-mapping fact, not a
single column on `retailers`.

Enforced in the service layer (documented in code, not a DB CHECK that
can't reference sibling rows): a `SUB_DISTRIBUTOR` row must have
`parent_partner_id` set to a row whose own `partner_type` is
`SUPER_DISTRIBUTOR`; `SUPER_DISTRIBUTOR`/`DIRECT_DISTRIBUTOR` rows must have
`parent_partner_id` NULL.

### 2.2 Reporting hierarchy (field/sales team)

```
Sales Officer / ISR / ASE → Area Sales Manager (ASM) → Regional Sales Manager (RSM) → Country Head
```

Modeled as `employees.reporting_manager_id` (self-referential FK), plus a
`role` enum: `SALES_OFFICER`, `ISR`, `ASE`, `ASM`, `RSM`, `COUNTRY_HEAD`,
`ADMIN`. Downline for a dashboard query = recursive walk of
`reporting_manager_id` (a recursive CTE — see §10).

---

## 3. Unique Code Generation

| Entity | Code source | Format |
|---|---|---|
| Distributor (Super or Direct) | Admin-assigned | free text, admin's choice |
| Sub Distributor | System-generated, strictly sequential | `SUB5001`, `SUB5002`, ... |
| Retailer | System-generated, strictly sequential | `RET50001`, `RET50002`, ... |

- Sequential codes are backed by real Postgres `SEQUENCE`s
  (`sub_distributor_code_seq` starting at 5001,
  `retailer_code_seq` starting at 50001) — sequences never go backwards or
  reuse a value even after the row referencing them is deactivated, which
  is exactly the "never reused" requirement without extra bookkeeping.
- Admin-assigned codes (`distribution_partners.code` for Super/Direct
  Distributors) are `UNIQUE` at the DB level and rows are never hard-
  deleted (only `is_active = false`), so a retired code physically can't be
  reassigned — the unique constraint still holds against the retired row.
- Manual duplicate-code attempts surface as `409 CODE_ALREADY_IN_USE`
  (unique-violation caught and translated, not a raw DB error).

---

## 4. Active / Inactive Status Tracking

`status_change_log` is one generic, extensible audit table (not one table
per entity type) capturing every activation/deactivation of a
`distribution_partner` or `retailer`: `entity_type`, `entity_id`,
`previous_status`, `new_status`, `changed_at`, `changed_by_employee_id`,
`reason`. A status report is `GET` over this table joined to the entity,
filterable by type/date range.

---

## 5. Retailer Classification

- `retailers.category` — `RETAIL` | `WHOLESALE`.
- `retailers.subcategory_id` → `retailer_subcategories` (admin-managed,
  flat list: id, name, is_active). Admin can add new subcategories with no
  code change. Exact starter list is still pending from Cuni (deferred —
  see §12); the table ships with a small placeholder seed (General Store,
  Grocery Store, Departmental Store) admin can edit/extend immediately.

---

## 6. Mapping Model

Every relationship below is its own table: `(id, <left>_id, <right>_id,
is_active, created_at, updated_at, deactivated_at)`, `UNIQUE(<left>_id,
<right>_id)`. Removing one mapping row (`is_active = false`, timestamped)
never touches any other row — that's the granular-removal requirement by
construction, not by extra logic.

| Table | Relationship |
|---|---|
| `distribution_partner_beat_mapping` | Distributor/Sub-Distributor ↔ Beat |
| `beat_retailer_mapping` | Beat ↔ Retailer (capped at 40 active, §7) |
| `retailer_distribution_partner_mapping` | Retailer ↔ Distributor/Sub-Distributor |
| `employee_distribution_partner_mapping` | Salesman ↔ Distributor/Sub-Distributor |
| `employee_beat_mapping` | Salesman ↔ Beat (authorization — *which* beats a salesman may work — plus an optional legacy `day_of_week` fallback, carried over from the MVP, that "today's beat" uses until the real PJP API, §8.2, is built and takes over as the authoritative daily assignment) |
| `employee_retailer_mapping` | Salesman ↔ Retailer (direct, independent of beat) |

All mapping creation/removal is admin-only (`requireRole("ADMIN")`).
Deletes are soft (`is_active=false` + `deactivated_at`) so history survives
— "removed" mappings stay queryable for audit, never disappear.

---

## 7. Beat Constraints

`beat_retailer_mapping` enforces **max 40 active retailers per beat** at
the service layer: the mapping service counts active rows for the target
beat before insert and rejects a 41st with `409 BEAT_CAPACITY_EXCEEDED`.
Checked at request time under the same DB transaction as the insert to
close the race between concurrent admin requests.

---

## 8. Mobile App — Core Navigation Flow (data model support)

```
Login → Face Recognition → PJP Check/Start Working Hours (GPS-verified)
  → Distributor List → Beat List → Retailer List (+ Add New Outlet)
    → Retailer Detail → [View Previous Orders | Place New Order]
```

This document specs the **backend data model and API contract** this flow
needs. The mobile screens implementing it are a later slice (see
`DECISIONS.md`) — Phase 1's first commit is the foundation everything else
is built on.

### 8.1 Face recognition (data model + pluggable provider)

`login_face_verifications(id, employee_id, attempted_at, is_match,
match_score, provider, created_at)`. A `faceVerificationProvider` adapter
(same pattern as the OTP adapter) — a `stub` provider (configurable
always-pass/always-fail for dev) until a real vendor is selected; swapping
providers is a config change, not a rewrite. **Not yet wired to login** in
this slice — see open items.

### 8.2 PJP (Permanent Journey Plan)

`pjp_entries(id, employee_id, plan_date, beat_id, is_weekly_off, status,
submitted_at, reviewed_by_employee_id, reviewed_at, review_note,
supersedes_pjp_entry_id, created_at, updated_at)`.

- `status`: `PENDING_APPROVAL` → `APPROVED` | `REJECTED`; a revision to a
  future, not-yet-started date creates a new row with
  `supersedes_pjp_entry_id` pointing at the prior one, which moves to
  `SUPERSEDED` once the new row is submitted.
- One weekly off per week enforced at the service layer (exactly one
  `is_weekly_off=true` row per employee per ISO week among
  `APPROVED`/`PENDING_APPROVAL` rows).
- A **partial unique index** `(employee_id, plan_date) WHERE status IN
  ('PENDING_APPROVAL','APPROVED')` guarantees only one live plan per date,
  while superseded/rejected history stays in the table.
- Approval action = the employee's `reporting_manager_id`; enforced in the
  service, not just the client.

### 8.3 Working hours / GPS day-start

`work_day_sessions(id, employee_id, work_date, started_at, start_latitude,
start_longitude, verified_retailer_id, ended_at, created_at, updated_at)`,
`UNIQUE(employee_id, work_date)`. "Start Working Hours" requires the
client's GPS coordinates to be within a configurable radius (default 200m
— see `system_settings`) of at least one retailer on that date's
*approved* PJP beat; the matching retailer is recorded as
`verified_retailer_id`. Rejects with `409 GPS_VERIFICATION_FAILED` if none
match.

### 8.4 Distributor → Beat → Retailer navigation

Read-side endpoints joining `employee_distribution_partner_mapping` →
`distribution_partner_beat_mapping` → `beat_retailer_mapping`, each scoped
to the logged-in employee — never a client-supplied distributor/beat id
without an ownership check (same pattern as the MVP's
`requireEmployeeDistributor`, generalized to the mapping tables).

### 8.5 Add New Outlet

Same OTP-gated flow as the MVP (`otp_verifications`, purpose
`RETAILER_CREATION`), extended with `category`, `subcategory_id`, and beat
context (creates the retailer **and** its `beat_retailer_mapping` in one
transaction, respecting the 40-cap). `system_settings` key
`otp_mandatory_for_outlet_creation` (boolean, admin-toggleable,
system-wide) — when `false`, the OTP step is skipped and the retailer is
created with `phone_verified_at = NULL`.

### 8.6 Place New Order — filters

`products` stays one shared company-wide catalog (as in the MVP); a new
`distribution_partner_product_inventory` join table
(`distribution_partner_id`, `product_id`, `available_qty`,
`is_focus_product`) is the distributor-specific overlay — "open the
selected distributor's inventory" is a join, not a duplicated product row
per distributor. Catalog endpoint filters: `focus=true`,
`inStockOnly=true` (i.e. `available_qty > 0`), search, sort
(`name` | `mrp`).

### 8.7 Order fulfillment

`sales_orders.status`: `SUBMITTED` → `SAVED` | `CANCELLED` | `DELIVERED`.
Only the distributor side (a future admin/distributor-portal action) can
transition status; `DELIVERED` is terminal — the API rejects any further
mutation once set, at the service layer, regardless of caller role.

---

## 9. Scheme Discount Logic — CONFIRMED, supersedes the MVP rule

Slab basis: order's base amount **excluding GST**.

| Order value (ex-GST) | Discount |
|---|---|
| Below ₹5,000 | 0% |
| ₹5,000 – ₹9,999 | 5% |
| ₹10,000 and above | 10% |

**Two-stage, non-stacking:**
- **Tentative** — computed at order-booking time from the booked subtotal.
  Shown to the salesman immediately; stored as `tentative_discount_pct` /
  `tentative_discount_amount` / `tentative_grand_total_amount` on
  `sales_orders`.
- **Final** — recomputed at delivery from the *actual delivered* subtotal
  (still ex-GST, i.e. after any line was adjusted/removed during
  fulfillment). Stored as `final_discount_pct` / `final_discount_amount` /
  `final_grand_total_amount`, set only on the `DELIVERED` transition. This
  is what's actually billed.

GST apportionment (unchanged mechanic from the MVP, reapplied to whichever
subtotal is being calculated): the order-level discount is spread across
lines proportional to each line's pretax share, then each line's own
`gst_rate` applies to its post-discount amount. Implemented in
`packages/shared/src/scheme.ts` as `calculateSchemeBreakdown(lines,
{stage: "TENTATIVE" | "FINAL"})`.

---

## 10. Dashboard / Home Page — downline visibility

Not a stored-aggregate table in Phase 1 — computed on read from
`work_day_sessions`, `beat_visit_log`, `sales_orders`, and a recursive CTE
over `employees.reporting_manager_id` for "my downline." Per-user, Daily
and MTD views; calendar Year→Month→date-range filter is just date-bounded
versions of the same queries. Order value MRP-vs-base toggle: a
`system_settings` key (`dashboard_order_value_basis`), global for Phase 1
— per-report toggle is deferred (see §12, matches the requirements doc's
own open question).

This is a query-layer concern; no new schema beyond what's already listed
is required to support it, so it is *not* part of this migration's table
list — flagged here so the extensibility claim is honest about where the
work actually lands (API endpoints in a later slice).

---

## 11. Admin Web Portal — Bulk Data Upload

`bulk_upload_jobs(id, upload_type, uploaded_by_employee_id, filename,
status, total_rows, success_rows, failed_rows, created_at, completed_at)`
+ `bulk_upload_row_errors(id, job_id, row_number, error_message,
raw_row_json)`. Upload types (Phase 1): `RETAILER`, `PRODUCT`,
`BEAT_RETAILER_MAPPING`, `EMPLOYEE`.

Shared pipeline (one parser/validator framework, one implementation per
type's row schema — this is what keeps 4 upload types from being 4 forked
copies of the same logic):
1. `GET /admin/bulk-upload/:type/template` → CSV with the exact expected
   headers.
2. `POST /admin/bulk-upload/:type` (multipart CSV) → parses all rows first
   (no partial DB writes on a parse-level failure), validates every row
   against that type's zod schema plus business rules (duplicate code
   within the file, duplicate code already in DB, missing required
   field), then inserts only the rows that pass, each in its own
   sub-transaction so one bad row doesn't roll back the good ones.
3. Response: `{jobId, totalRows, successRows, failedRows, errors: [{row,
   message}]}` — every failed row's reason, not just a count.
4. Blank retailer `code` in the upload → auto-assigned from
   `retailer_code_seq`, same as single-entry creation (§3).

---

## 12. Explicitly Deferred (unchanged from the requirements doc)

- Exact retailer sub-category list (Cuni to provide) — placeholder seed in
  place, admin-editable meanwhile.
- MRP-vs-base-price display: global setting for Phase 1, not per-report.
- Any enhancement beyond Phase 1 basic scope.

---

## 13. What this slice builds vs. defers

Given the size of the full Phase 1 scope (two applications, ~13
requirement areas), this is built **vertical-slice, gated by review** —
the same working style as the MVP (`DECISIONS.md`, "Build order changed to
vertical slices").

**This slice (Foundation):**
- Full schema migration for everything in §2–§9, §11 above — including
  `pjp_entries`, `work_day_sessions`, and `login_face_verifications`, whose
  *tables* are built now even though their APIs are not (below).
- Backend: org hierarchy CRUD (all 3 distributor types), retailer
  CRUD+classification, retailer subcategories CRUD, beats CRUD, all 6
  mapping tables with granular create/remove + 40-cap enforcement, status
  toggle + audit log, code generation/validation, `system_settings`
  (OTP-mandatory toggle + dashboard basis), bulk upload for all 4 types,
  scheme v2 (tentative+final) wired into order creation/delivery, employee
  role hierarchy + reporting-manager relationship, admin-role auth.
- Existing MVP mobile screens/endpoints (login, forgot-password, beat/
  retailer/visit/order flows) refactored onto the new schema so the app
  keeps building and running end-to-end, not just the admin side.

**Deferred to later slices (not started — schema exists, API/UI does not):**
- Admin Web Portal frontend (no UI exists yet for any admin capability —
  this slice is API-only, matching how the MVP built the API before the
  screen in each vertical slice).
- **PJP submit/approve/revise API endpoints** — `pjp_entries` table exists;
  no service/routes yet. Weekly-off-per-week enforcement, manager-approval
  routing, and the future-date-only revision rule all land with that API.
- **GPS day-start verification API** — `work_day_sessions` table exists;
  no endpoint yet. Radius check against `system_settings` value lands with it.
- **Face recognition** — `login_face_verifications` table + provider-adapter
  *interface* only; no real vendor wired, no login-flow integration, no
  endpoint yet.
- **Dashboard API endpoints** — query layer described in §10, not yet built.
- Mobile screens for anything above, plus distributor→beat→retailer
  navigation, outlet creation form, and catalog/cart with focus/stock
  filters (these need the admin-side data to exist first, which this slice
  provides, but the screens themselves are next).

---

## 14. Open Questions carried over

1. Real retailer sub-category list from Cuni.
2. GPS verification radius (Phase 1 default: 200m — confirm with Cuni).
3. Whether `dashboard_order_value_basis` should ever become per-report
   rather than global.
4. Face recognition vendor selection (data model is vendor-agnostic
   pending this).
