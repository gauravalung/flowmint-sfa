# Flowmint SFA MVP

Slice A: monorepo scaffold, database schema + migration, seed data, login,
forgot-password (OTP), and the admin employee-provisioning CLI script.
See `claude/SFA_MVP_Scope_Locked.md` and `claude/DECISIONS.md` (mirrored
into this repo — also kept in the Claude project) for the full spec and
decision history.

## What's in Slice A

- **Backend** (`apps/api`): Express + TypeScript. Login, token refresh,
  forgot-password (request/verify/reset via OTP), all backed by Postgres.
- **Mobile** (`apps/mobile`): React Native / Expo. Login screen and the
  three-step forgot-password flow, wired to the real backend (no mocks).
- **Shared** (`packages/shared`): TypeScript types + zod validation schemas
  used by both.

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

# 6. Seed realistic test data (1 salesman, 1 beat, 8 retailers, 20 products)
npm run seed
# This prints the salesman's login credentials — keep that output, you'll
# need employee_code + password to log in from the phone.

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

Log in with the `employee_code` / password the seed script printed. To test
forgot-password, request an OTP from the app — since no SMS provider is
configured yet, the OTP is printed to the terminal where `npm run dev` (the
API) is running, not actually sent as a text message. Look for a line like:

```
[otp:console] would send OTP 123456 to 9876543210
```

## Admin: creating another salesman login

There's no admin web portal in this MVP and deliberately no HTTP endpoint
for this either (see `claude/DECISIONS.md`, round 4) — it's a local script:

```bash
cd apps/api
npm run create-employee -- --code=SM002 --name="Suresh Patel" --phone=9876500002
```

This prints a temporary password once. It is not recoverable — hand it to
the employee directly, or have them use forgot-password on first login.

## What's verified vs. what needs your phone

I've verified from this sandbox: the full login/lockout/refresh/forgot-
password flow end-to-end against the real database (including account
lockout after 5 failed attempts, OTP expiry/attempt-cap/resend-cooldown,
refresh-token invalidation on password reset, and enumeration-safe generic
error responses), the admin CLI script, and that the mobile app type-checks
and bundles cleanly for Android (716 modules, no errors).

What I have not verified, because this sandbox has no physical Android
device attached: the actual on-device experience — layout, keyboard
behavior, real network conditions. That needs your phone, per the steps
above.

## Next: Slice B

Today's beat, retailer detail, visit check-in/close, off-beat search, and
new outlet creation (OTP-verified). Waiting on your review of this slice
before starting.
