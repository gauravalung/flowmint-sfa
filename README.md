# Flowmint SFA — Phase 1

VLCC Personal Care's Flowmint SFA mobile app + Admin Web Portal, Phase 1
("basic scope"): full distributor hierarchy, mapping model, code
generation, status tracking, bulk upload, and a two-stage scheme discount
— see `claude/Flowmint_Phase1_Scope_Locked.md` for the full spec and
`claude/DECISIONS.md` for the decision history, including how this
supersedes the earlier single-salesman MVP (`claude/SFA_MVP_Scope_Locked.md`,
kept for reference).

## What's in this slice (Foundation)

Backend-first, matching how every previous slice in this repo has been
built: the API for a capability lands before its screen.

- **Schema**: full Phase 1 schema — Super/Direct/Sub Distributor hierarchy,
  all six mapping tables (granular add/remove, 40-outlet beat cap),
  sequential code generation, status-change audit log, retailer
  classification, PJP/GPS/face-recognition tables (schema only — see
  "Not in this slice" below), two-stage (tentative + final) scheme
  discount, bulk-upload job tracking.
- **Backend** (`apps/api`): org hierarchy CRUD, retailer CRUD + admin
  bulk upload (retailer/product/beat-retailer-mapping/employee masters,
  each with a downloadable template and row-level error reporting), beat
  CRUD, all six mapping endpoints, status toggle + history, distributor
  catalog/inventory, order booking with tentative-at-booking +
  final-at-delivery scheme calculation, admin employee provisioning (HTTP
  + CLI script), system settings (OTP-mandatory toggle). Plus the
  MVP-era mobile endpoints (login, forgot-password, today's beat, visits,
  off-beat search, outlet creation), refactored onto the new schema.
- **Mobile** (`apps/mobile`): the screens already built in earlier work
  (login, forgot-password, today's beat, retailer detail, close visit,
  off-beat search, add outlet) updated to match the new API contract —
  outlet creation now collects a category and is scoped to the beat it
  was opened from, per spec §8.5.
- **Shared** (`packages/shared`): types + zod validation schemas used by
  both apps.

## Not in this slice (schema exists, API/UI does not yet)

Admin Web Portal frontend · PJP submit/approve API · GPS day-start
verification API · face recognition (data model + provider-adapter
interface only, no vendor wired) · dashboard API · mobile screens for
distributor→beat→retailer navigation, catalog/cart, and PJP/GPS. See
`claude/Flowmint_Phase1_Scope_Locked.md` §13 for the full breakdown and
what's planned for the next slice.

## One important change from the original plan

The spec called for Prisma. This sandbox's network policy blocks
`binaries.prisma.sh`, which Prisma's migration/query engines need to
download — confirmed with a direct request, not a fluke. Rather than build
against a tool I couldn't actually run and verify, the persistence layer
uses plain `pg` (node-postgres) + `node-pg-migrate` (hand-written SQL
migrations) instead. No native binary dependency, same schema, same
business rules — see `claude/DECISIONS.md` for the full reasoning. This
should not affect you at all once you're running on your own machine, but
it's why the code doesn't look like the Prisma setup you might expect.

## Prerequisites (your machine, not this sandbox)

- Node.js 20+
- Docker (for Postgres) — or your own local Postgres 16, if you already run one
- Expo Go app installed on the Android phone you're testing with
- Your phone and your computer on the same Wi-Fi network (simplest path),
  or use Expo's tunnel mode if they can't be

## Setup

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install all workspace dependencies
npm install

# 3. Build the shared package (mobile and api both depend on it)
npm run build:shared

# 4. Set up the API's environment file
cp apps/api/.env.example apps/api/.env
# The defaults match docker-compose.yml, so this works as-is for local dev.
# JWT/reset/verification secrets are placeholder values — fine for local
# testing, but replace them before this ever runs anywhere real.

# 5. Run the migration
cd apps/api
npm run migrate:up

# 6. Seed realistic test data: 1 company; 1 Super + 1 Direct + 1 Sub
# Distributor; an ADMIN, RSM, ASM, and Sales Officer with a real reporting
# chain; 1 beat, 8 retailers, 5 brands, 5 categories, 20 products.
npm run seed
# This prints login credentials for all four seeded roles — keep that
# output, you'll need employee_code + password to log in.

# 7. Start the API
npm run dev
# Leave this running in its own terminal. It listens on port 4000.
```

## Running on your Android phone

The mobile app needs to reach the API over your local network — `localhost`
inside the app refers to the *phone*, not your computer, so this needs one
small config step:

```bash
# Find your computer's LAN IP (not 127.0.0.1)
#   macOS/Linux: ifconfig | grep "inet " 
#   Windows:     ipconfig
```

Edit `apps/mobile/app.json` and change `expo.extra.apiBaseUrl` from
`http://localhost:4000/api/v1` to `http://<your-LAN-IP>:4000/api/v1`
(e.g. `http://192.168.1.42:4000/api/v1`).

Then:

```bash
cd apps/mobile
npm install   # if you haven't already, from the repo root `npm install` covers this
npx expo start
```

Scan the QR code with Expo Go on your Android phone (same Wi-Fi network as
your computer). If your phone can't reach your computer directly — separate
networks, campus/office Wi-Fi with client isolation — run
`npx expo start --tunnel` instead, which routes through Expo's relay; it's
slower but works across networks.

Log in with the Sales Officer credentials the seed script printed (`SO001`)
to see the field flow, or `ADM001` for admin endpoints (no admin UI yet —
see below). To test forgot-password, request an OTP from the app — since
no SMS provider is configured yet, the OTP is printed to the terminal
where `npm run dev` (the API) is running, not actually sent as a text
message. Look for a line like:

```
[otp:console] would send OTP 123456 to 9876543210
```

## Admin: creating another employee login

Unlike the earlier single-salesman MVP, Phase 1 exposes this over HTTP as
well as the CLI script — see `claude/DECISIONS.md` 2026-09-09 for why the
CLI-only tradeoff no longer applies now that there's a real multi-employee
rollout and a bulk-upload feature to match:

```bash
# HTTP (requires an ADMIN access token — see the auth endpoints above)
curl -X POST http://localhost:4000/api/v1/admin/employees \
  -H "Authorization: Bearer <admin access token>" -H "Content-Type: application/json" \
  -d '{"employeeCode":"ASM002","name":"Suresh Patel","phone":"9876500002","role":"ASM","reportingManagerId":"<rsm employee id>"}'

# or the CLI script, unchanged in spirit from the MVP:
cd apps/api
npm run create-employee -- --code=ASM002 --name="Suresh Patel" --phone=9876500002 --role=ASM --manager=RSM001
```

Both print/return a temporary password once. It is not recoverable — hand
it to the employee directly, or have them use forgot-password on first
login. Valid `role` values: `SALES_OFFICER`, `ISR`, `ASE`, `ASM`, `RSM`,
`COUNTRY_HEAD`, `ADMIN`.

## Admin: bulk upload

```bash
# Download a template
curl -H "Authorization: Bearer <admin access token>" \
  http://localhost:4000/api/v1/admin/bulk-upload/RETAILER/template -o retailers_template.csv

# Upload a filled-in CSV — retailer/product codes and any missing
# subcategory/brand/category referenced by name are created automatically.
curl -H "Authorization: Bearer <admin access token>" \
  -F "file=@retailers.csv" \
  http://localhost:4000/api/v1/admin/bulk-upload/RETAILER
```

Upload types: `RETAILER`, `PRODUCT`, `BEAT_RETAILER_MAPPING`, `EMPLOYEE`.
The response reports `totalRows`/`successRows`/`failedRows` plus a
per-row `errors` array naming exactly why each failed row was rejected —
no partial/silent imports.

## What's verified

Migration applies cleanly against a real Postgres database (28 tables);
seed script runs end-to-end and prints working logins for all four seeded
roles; `apps/api` and `apps/mobile` both type-check with no errors;
`apps/mobile` bundles cleanly for Android (723 modules, no errors).
Smoke-tested against the running API: login for every seeded role;
today's-beat and distributor→beat→retailer navigation; admin creation of
a Super/Sub Distributor (auto-generated `SUBnnnn` code) with duplicate-code
rejection; the beat 40-outlet cap (41st mapping correctly rejected,
`BEAT_CAPACITY_EXCEEDED`); order booking with the tentative scheme
discount (10% slab at an ex-GST subtotal over ₹10,000); order delivery
recalculating the *final* scheme discount from a reduced delivered
quantity (correctly dropping to the 0% slab); OTP-gated field outlet
creation end-to-end (request → verify → create, phone marked verified);
bulk retailer upload (partial success with a row-level error reported for
a missing required field, auto-generated `RETnnnnn` codes for blank-code
rows). What has not been verified: the actual on-device mobile experience
(no physical Android device in this sandbox) and the admin web portal,
PJP/GPS/dashboard/face-recognition APIs, which are not built yet — see
"Not in this slice" above.

## Next

Pick up from `claude/Flowmint_Phase1_Scope_Locked.md` §13: the Admin Web
Portal frontend, PJP submit/approve + GPS day-start APIs and screens,
dashboard APIs, and face-recognition vendor integration — each its own
gated slice, same working style as every slice before this one.
