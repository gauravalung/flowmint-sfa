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

## Faster iteration: browser preview instead of an APK

For everyday development you don't need a phone or an APK at all — the app
also runs in a regular browser tab via Expo's web support
(`react-dom` / `react-native-web`), with Fast Refresh on every save:

```bash
cd apps/mobile
npm run web
# opens http://localhost:8081 in your browser
```

This is a **dev-only convenience**, not a target platform — `app.json`'s
`platforms` list still exists only for that build config, not as a claim
the app ships on web. A few things behave differently there than on the
real device:

- **Auth tokens**: `expo-secure-store` (Keychain/Keystore) has no web
  backing, so `src/storage/secureStore.ts` falls back to `localStorage` on
  web only (`Platform.OS === "web"`). Never used on-device — the Android
  build still uses real secure storage.
- **API URL**: `expo.extra.apiBaseUrl` (`apps/mobile/app.json`) defaults to
  the deployed production API (`flowmint-api.onrender.com`), so the browser
  preview talks to real production data out of the box, same as a phone
  would with no config changes. To point it at your own local API instead,
  set it to `http://localhost:4000/api/v1` — since the browser runs on the
  same machine as the API here, plain `localhost` works, unlike the LAN-IP
  dance the phone setup above needs. (Running in a Codespace instead? See
  below — `localhost` doesn't mean the same thing there.)
- **Layout/feel**: touch gestures, safe-area insets, and native navigation
  transitions won't exactly match a real Android device — good enough to
  iterate on logic and screen flow, not a substitute for a final check on
  a physical device (or the debug APK from
  `.github/workflows/build-mobile-apk.yml`) before calling something done.

You still only need to rebuild/reinstall the debug APK when something
*native* changes (a new native dependency, `app.json` permissions/plugins,
an Expo SDK bump) — ordinary screen and logic changes hot-reload in either
the browser or an already-installed APK without a rebuild.

## Running the whole stack in a GitHub Codespace

You don't need your own machine at all — `.devcontainer/devcontainer.json`
sets up a ready-to-go environment from GitHub's web UI: **Code → Codespaces
→ Create codespace on main**. First boot takes a few minutes and runs
`npm install`, `npm run build:shared`, copies `apps/api/.env.example` →
`.env`, and starts Postgres in the background automatically (mirrors Setup
steps 1–4 above). Then, in the Codespace's terminal:

```bash
# One-time: migrate + seed (same as Setup steps 5-6)
cd apps/api && npm run migrate:up && npm run seed
# Keep the printed employee_code/password — you'll need them to log in.

# Start the API (leave running in its own terminal tab)
npm run dev

# In another terminal tab: start the mobile browser preview
cd apps/mobile && npm run web
```

Codespaces forwards ports 4000 (API) and 8081 (mobile) automatically —
open the **Ports** tab, and the 8081 URL is your app, reachable from any
browser, including your phone's, with nothing installed. One extra step
the first time: right-click port **4000** in that same Ports tab → **Port
Visibility → Public**. It needs to be reachable without a GitHub-auth
redirect getting in the way of the app's own API calls (the forwarded
URLs are still unguessable, but this does mean anyone with that exact URL
during the Codespace's life could hit the API — fine for throwaway dev
data with the placeholder secrets from `.env.example`, not something to
do with anything real). `apps/mobile/app.config.js` detects the Codespaces
environment automatically and points `apiBaseUrl` at the forwarded API
port instead of `localhost` or production — no manual edit needed.

Note: this gets you the full stack (API + Postgres + browser preview) for
fast iteration and even a phone-browser check with zero local setup — it
does **not** build a real Android APK (no Android SDK in this devcontainer
by design, to keep first-boot fast). For that, still use
`.github/workflows/build-mobile-apk.yml` or the debug APK it produces.

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
