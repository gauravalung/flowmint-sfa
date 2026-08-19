# Flowmint SFA MVP — Locked Scope & Technical Spec (v2)

**Status:** Slice A complete and verified — see DECISIONS.md for the Slice A completion note.
**Date:** 18 August 2026 (v2 — supersedes v1 same date)
**Source material:** `Flowmint_Sales_Management_DMS_SFA_Proposal.docx` (v1.0), `Flowmint_SFA_Project_Kickoff_Instructions.md`, `Flowmint_CLAUDE_Project_Instructions.md`, plus user instructions dated 18 Aug 2026 (four rounds).

This is a deliberately narrow slice of Phases 1–3 of the roadmap. It is **not** a replacement for the full spec-first plan; DMS, SAP integration, a real scheme engine, multi-company and dashboards all still apply later.

**Note on scope growth:** the real catalog size (2,500 SKUs) and "general Android user" framing pushed this from a one-day field pilot toward something closer to a real rollout for one user. Confirmed still single-pilot-salesman scale (see §2, decision 13) — but GST correctness, account recovery and outlet self-service are now real requirements, not nice-to-haves, so they're treated as such below.

---

## 1. MVP Goal & Definition of Done

A salesman can log in, see who he is supposed to visit today, record a visit (including visits that produce no order), create a new outlet in the field when needed, browse a 2,500-SKU catalog with prices, book an order with correct scheme-discount and GST math, and submit it — end to end, on a phone, tolerant of dead zones.

**Definition of done:** a real salesman can use this app for one full day of retailer visits and order booking — including adding a genuinely new outlet — and the order total his retailer sees is the actual payable amount, not a placeholder.

---

## 2. Confirmed Decisions

| # | Decision | Answer |
|---|---|---|
| 1 | Beat scheduling | Day-of-week cycle |
| 2 | Backend framework | Express + TypeScript — prototype posture |
| 3 | Order quantity unit | Pieces |
| 4 | Login identifier | Employee code (phone-based login later) |
| 5 | UI language | English only |
| 6 | Pilot | One real salesman |
| 7 | Connectivity | Offline-tolerant |
| 8 | Field additions | No-order outcome + reason; off-beat ordering; same-day cancel |
| 9 | GPS at check-in | Deferred — columns reserved |
| 10 | GST structure | Varies by product — `gst_rate` on each product, snapshotted per order line |
| 11 | OTP/SMS provider | User will set up an account; Claude builds against a swappable adapter, defaulting to MSG91, with console-log fallback until a real API key is supplied |
| 12 | Outlet approval | Live immediately after OTP verification — no admin approval queue |
| 13 | Scale | Still single pilot salesman — security defaults kept at pilot scale, not load-tested or Play-Store-hardened |
| 14 | Scheme discount floor | Confirmed: ₹2,500 floor. < ₹2,500 → 0%; ₹2,500–₹5,000 → 2%; > ₹5,000 → 5%. Non-stacking. |
| 15 | Admin employee provisioning | CLI script, not an HTTP endpoint. No network-reachable way to create accounts exists; smallest attack surface for one-account-scale provisioning. |
| 16 | Persistence layer | **pg + node-pg-migrate, not Prisma.** binaries.prisma.sh is blocked in the build sandbox — confirmed with a direct request. No schema or business-rule change; see DECISIONS.md. |

---

## 3. Feature List (v1)

1. Login — employee code + password
2. Forgot password — OTP to the employee's registered phone, then reset
3. Today's beat — assigned retailers for today's weekday, in sequence, with visit status
4. Retailer detail — name, owner, address, tap-to-call
5. Visit check-in — one deliberate "Start Visit"; closes via outcome (order booked / no order + reason)
6. Off-beat retailer — search all retailers in the salesman's distributor, book against them
7. New outlet creation — OTP-verified against the shop's phone, live immediately
8. Product catalog — search + lightweight category filter, virtualized list (revised for 2,500 SKUs)
9. Order booking — cart with quantities in pieces, running total
10. Scheme discount + GST — calculated server-side at submission (see §6, confirmed slabs)
11. Order submission — stored against retailer, beat, salesman, date; queued locally if offline
12. Order history — own orders, last 7 days, expandable line items
13. Cancel order — own orders, same day only

---

## 4. Deliberate Simplifications (unchanged from v1, restated)

- Single company/distributor **code path** — `company_id`/`distributor_id` columns exist, hardcoded to seed values.
- No SAP / Tally / Marg / Busy integration.
- No order approval workflow (status enum has room to grow).
- One role: Salesman.
- No inventory, returns, collections, admin web portal.
- No audit trail beyond `created_at`/`updated_at`, plus the minimal lockout counters in §5 (data-safety exception, not a full audit log).

**Reopened from v1, explicitly:**
- **Flat price list → still flat, but now with real scheme math.** One hardcoded slab rule, not a scheme engine (see §6). If more scheme rules arrive, this becomes a real `schemes`/`scheme_slabs` structure — not before.
- **Catalog: flat list → search + category filter.** 2,500 SKUs makes a pure flat scroll unusable. This is a partial reversal of the v1 cut, done openly rather than silently.
- **Retailer creation: "not building" → building, OTP-gated.** Conflicts with the source proposal's stated permission model (§11 of the kickoff doc: retailer creation is an Admin/Manager action). OTP is a safeguard against fabricated field entries, not equivalent governance — logged as a deviation, not pretended away.

---

## 5. Database Schema (MVP subset, v2 — implemented as plain SQL, see DECISIONS.md)

All tables carry `created_at`/`updated_at`. All master tables carry `is_active BOOLEAN DEFAULT true`.

### companies, distributors *(unchanged — placeholder, single seeded row each)*

### employees
`id` PK · `company_id` FK · `distributor_id` FK NULL · `employee_code` UNIQUE · `name` · `phone` · `role` ENUM(`SALESMAN`) · `password_hash` · `failed_login_attempts` INT DEFAULT 0 · `locked_until` TIMESTAMPTZ NULL · `last_login_at` TIMESTAMPTZ NULL · `refresh_token_version` INT DEFAULT 0 · `is_active`

> **New for account safety:** `failed_login_attempts`/`locked_until` implement lockout without a full audit log table. `refresh_token_version` lets a password reset or admin action invalidate every outstanding refresh token by bumping this value — tokens carry the version they were issued at.
> **Business rule (not enforced by schema, enforced by API):** `phone` is admin-settable only, never self-service. A compromised session that could redirect its own phone number would defeat the password-reset OTP entirely.

### retailers
`id` PK · `company_id` FK · `distributor_id` FK · `code` UNIQUE · `name` · `owner_name` · `address_line` · `city` · `pincode` · `phone` · `source` ENUM(`SEED`,`ADMIN`,`FIELD`) DEFAULT `'FIELD'` · `created_by_employee_id` FK NULL · `phone_verified_at` TIMESTAMPTZ NULL · `is_active`

> `source`/`created_by_employee_id`/`phone_verified_at` make field-created outlets traceable and reversible without an approval queue.

### beats, beat_retailer_mapping, beat_employee_mapping, brands *(unchanged from v1)*

### categories
`id` PK · `name` · `is_active`

### products
`id` PK · `company_id` FK · `brand_id` FK · `category_id` FK · `sku_code` UNIQUE · `name` · `pack_size` · `uom` DEFAULT `'PCS'` · `mrp` NUMERIC(12,2) · `price` NUMERIC(12,2) · `gst_rate` NUMERIC(5,2) · `is_active`
Index on (`category_id`), index on `name` (search), trigram index on `sku_code` for fuzzy search.

### otp_verifications
`id` PK · `phone` · `purpose` ENUM(`RETAILER_CREATION`,`PASSWORD_RESET`) · `otp_hash` · `expires_at` · `attempt_count` INT DEFAULT 0 · `verified_at` TIMESTAMPTZ NULL · `employee_id` FK NULL *(set for PASSWORD_RESET)* · `created_at`

> OTP is hashed at rest, never logged in plaintext. 5-minute expiry, capped verify attempts, resend cooldown enforced at the service layer using `created_at`.

### beat_visit_log *(unchanged from v1)*

### sales_orders
`id` PK · `order_number` UNIQUE · `company_id` FK · `distributor_id` FK · `employee_id` FK · `retailer_id` FK · `beat_id` FK NULL · `beat_visit_log_id` FK NULL · `order_date` DATE · `status` ENUM(`SUBMITTED`,`CANCELLED`) · `total_qty` INT · `subtotal_amount` NUMERIC(14,2) *(pretax, pre-discount)* · `discount_pct` NUMERIC(5,2) · `discount_amount` NUMERIC(14,2) · `taxable_amount` NUMERIC(14,2) · `gst_amount` NUMERIC(14,2) · `grand_total_amount` NUMERIC(14,2) *(what the retailer actually owes)* · `cancelled_at` NULL · `client_uuid` UUID UNIQUE

### sales_order_items
`id` PK · `sales_order_id` FK · `product_id` FK · `sku_code_snapshot` · `product_name_snapshot` · `pack_size_snapshot` · `uom_snapshot` · `unit_price` NUMERIC(12,2) · `quantity` INT · `line_amount` NUMERIC(14,2) *(pretax)* · `line_discount_amount` NUMERIC(14,2) · `gst_rate_snapshot` NUMERIC(5,2) · `line_gst_amount` NUMERIC(14,2) · `line_total` NUMERIC(14,2) *(line_amount − line_discount_amount + line_gst_amount)*

---

## 6. Scheme Discount + GST Calculation (server-authoritative, CONFIRMED — not yet wired to an order endpoint; that's Slice C)

Implemented as a plain calculation function in `packages/shared/src/scheme.ts` — **not** a `schemes` table structure. This is deliberate: one hardcoded rule doesn't earn a generic engine. If a second or third scheme rule shows up, that's the trigger to build the real thing.

**Slab rule** (order-level, applied to pretax subtotal) — confirmed:
- subtotal < ₹2,500 → 0% discount
- ₹2,500 ≤ subtotal ≤ ₹5,000 → 2% discount
- subtotal > ₹5,000 → 5% discount

Non-stacking (one rate applies, not cumulative). Boundaries literal: exactly ₹2,500 and exactly ₹5,000 both get 2%; only strictly above ₹5,000 gets 5%.

**GST, since it varies per product:** the order-level discount is apportioned across lines proportionally to each line's share of the pretax subtotal, then each line's own `gst_rate` is applied to its post-discount amount.

```
subtotal            = Σ line_amount
discount_pct        = slab(subtotal)
discount_amount      = subtotal × discount_pct
line_discount_i      = line_amount_i × (discount_amount / subtotal)
line_taxable_i       = line_amount_i − line_discount_i
line_gst_i           = line_taxable_i × gst_rate_i
gst_amount           = Σ line_gst_i
taxable_amount       = subtotal − discount_amount
grand_total_amount   = taxable_amount + gst_amount
```

All rounding to 2 decimal places at the line level before summing, to avoid rupee-level drift between the displayed total and the stored total.

**Still a design choice worth knowing about, not yet challenged:** the proportional-apportionment method above is the standard approach when one discount % meets multiple GST rates, but it is a choice, flagged in §13.

---

## 7. API Specification (v2 — Slice A subset implemented; full spec below for reference)

Base path `/api/v1`. Error format: `{"error":{"code","message","details"}}` — including rate-limit responses, which use the same envelope.

**Auth — implemented in Slice A, verified end-to-end:**
- `POST /auth/login` — generic error for wrong code/wrong password/locked account; lockout after 5 failed attempts (15 min); rate-limited (20/15min/IP)
- `POST /auth/refresh` — rotates both tokens; rejects on `refresh_token_version` mismatch
- `POST /auth/forgot-password/request` `{employeeCode}` → always the same generic response; rate-limited (10/15min/IP)
- `POST /auth/forgot-password/verify` `{employeeCode, otp}` → short-lived reset token
- `POST /auth/forgot-password/reset` `{resetToken, newPassword}` → sets new password, bumps `refresh_token_version` (logs out every other session)

**Outlet creation — Slice B:**
- `POST /retailers/otp/request` `{phone}` → sends OTP to the shop's phone
- `POST /retailers/otp/verify` `{phone, otp}` → short-lived verification token
- `POST /retailers` `{verificationToken, name, ownerName, addressLine, city, pincode, phone}` → creates retailer, `source=FIELD`, immediately usable

**Catalog — Slice C** *(revised for 2,500 SKUs)*
- `GET /products?search=&category_id=&page=&page_size=` — paginated, server-side search

**Orders — Slice C**
- `POST /orders` returns the full breakdown (`subtotalAmount`, `discountPct`, `discountAmount`, `taxableAmount`, `gstAmount`, `grandTotalAmount`) computed server-side.

Everything else from v1 (`/me/beat/today`, `/retailers/:id`, `/visits`, `/orders/mine`, `/orders/:id/cancel`) is Slice B/C/D.

**Admin employee provisioning is not an API endpoint** — CLI script (`npm run create-employee`), implemented and verified in Slice A.

---

## 8. Screens (v2)

**Implemented in Slice A, verified via type-check + Android bundle export:**
- **Login** — employee code + password
- **Forgot Password** (3 screens) — request → OTP → new password
- **Home** — placeholder landing screen, replaced by Today's Beat in Slice B

**Slice B/C:**
- **Add Outlet** — form → OTP screen → saved, immediately available for ordering
- **Product Catalog** — search bar + category filter chips + virtualized list
- **Cart Review** — subtotal, discount %, discount amount, GST, grand total as separate lines

---

## 9. Offline Behaviour — unchanged, with one explicit boundary

Outlet creation and password reset **require live connectivity**. Beat viewing, visit check-in/close, catalog browsing and order submission remain offline-tolerant as specified in v1. (Offline outbox itself is Slice C.)

---

## 10. Explicitly Not Building

Multi-company logic · sub-distributors · a real scheme engine (tables) · price lists · inventory · returns · collections/payments · SAP/Tally/Marg/Busy · order approval workflow · full RBAC matrix · dedicated audit-log table · admin web portal · DMS · dashboards · GPS capture · repeat-last-order prefill · Play Store distribution/multi-device account management.

---

## 11. Stack & Repo Structure (as actually built)

Monorepo/npm workspaces, `apps/api` (Express+TS), `apps/mobile` (React Native/Expo), `packages/shared`. **PostgreSQL + pg + node-pg-migrate** (not Prisma — see decision 16 and DECISIONS.md). Strict layering (route → controller → service → repository) preserved so the "prototype" framework choice stays cheap to migrate.

**New dependency:** an SMS/OTP provider account (MSG91 by default) — real OTP delivery is blocked until you supply an API key. Until then, OTPs log to console for dev/testing (verified working in Slice A).

---

## 12. Build Slices & Approval Gates (v2)

| Slice | Contents | Status |
|---|---|---|
| **A** | Monorepo scaffold, schema + migration, seed script, admin employee-provisioning CLI script, login, forgot-password (OTP), login + forgot-password screens, type-checked + Android-bundled | **Complete, verified end-to-end. Awaiting your review before B.** |
| **B** | Today's beat, retailer detail, check-in, no-order close, off-beat search, new outlet creation (OTP) | Not started |
| **C** | Catalog (search + filter + virtualized list), cart, scheme discount + GST calculation, order submit, offline outbox, idempotency | Not started |
| **D** | Order history, same-day cancel, full salesman-day UAT walkthrough | Not started |

**Provisioning note:** the CLI script shares the same service-layer `provisionEmployee()` function that would back an HTTP endpoint if one is ever added — the interface split is at the service boundary, not duplicated logic.

---

## 13. Assumptions Flagged (still open)

1. MSG91 as the default OTP provider pending your account setup; adapter pattern means switching providers is a config change, not a rewrite.
2. Discount apportionment across lines is proportional to pretax line share — a design choice worth knowing about rather than assuming.
3. `phone_verified_at` on a field-created retailer is not re-checked later.

---

## 14. Open Questions carried over

1. Real Android version floor on the pilot salesman's actual phone.
2. Target pilot date.
3. Whether the pilot salesman needs a tax-inclusive number verbally called out — answered structurally by §6 — but confirm this matches how he actually negotiates at the counter.
