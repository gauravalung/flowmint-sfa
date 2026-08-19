# Flowmint — Decision Log

Running record of what was decided, when, and why. Per `Flowmint_CLAUDE_Project_Instructions.md` §3.6.

---

## 2026-08-18 — Pivot to an SFA mobile MVP ahead of the full spec

**Decision:** Fast-forward from the spec-first plan to a working MVP of the SFA mobile app only — a narrow slice of Phases 1–3.
**Why:** Get something real into a salesman's hands early rather than spending weeks in pure documentation.
**Status:** The full roadmap (DMS, SAP, schemes, multi-company, dashboards) still stands. This MVP does not replace the spec plan; it precedes it.

---

## 2026-08-18 — Beat scheduling: day-of-week cycle

**Decision:** Day-of-week cycle, stored as `day_of_week` on `beat_employee_mapping`.
**Why:** Matches how FMCG beats actually run; neither source doc defined this.

---

## 2026-08-18 — Backend framework: Express + TypeScript ("prototype" posture)

**Decision:** Express + TypeScript, not NestJS. **Recommendation (NestJS) overruled.**
**Mitigation:** Strict layering (route → controller → service → repository), zero business logic in route handlers, so a later migration is mechanical.
**Risk on the record:** prototypes become production by default — an explicit keep-and-harden vs. discard-and-rebuild decision is owed at the end of the pilot.

---

## 2026-08-18 — Connectivity: offline-tolerant, not offline-first

**Decision:** Local cache of today's beat/catalog, locally persisted cart, outbox with retry, server-side dedupe via `client_uuid`.
**Why:** The definition of done requires surviving a real field day; true offline-first (local DB, delta sync, conflict resolution) is weeks of work and was deferred.
**Boundary added 2026-08-18 (round 2):** outlet creation and password reset require live connectivity — both depend on real-time OTP delivery and are explicitly excluded from the offline outbox.

---

## 2026-08-18 — Field workflow additions accepted into v1

No-order outcome + reason · off-beat retailer ordering · same-day cancel. Each reuses existing screens or costs roughly one column plus one sheet.

---

## 2026-08-18 — GPS at check-in: deferred

**Recommendation (best-effort GPS) overruled.** Consequence on record: visit logs are unverifiable. Columns reserved for a future client-only enablement.

---

## 2026-08-18 — Scope cuts applied to the proposed feature list (round 1)

Flat catalog list (no drill-down) · outcome-driven visit close (not a separate check-out tap) · order history trimmed to 7 days.
**Partially reversed 2026-08-18 (round 2):** flat catalog list reopened once real SKU count (2,500) was known — see below.

---

## 2026-08-18 — Build order changed to vertical slices

Endpoint + screen + real wiring per slice, no mock data. Overrides the requested "backend done → mobile done → wired" gating; new gates are A) scaffold+login, B) beat+visit, C) catalog+order, D) history+UAT.

---

## 2026-08-18 — Minor locked decisions (round 1)

Quantity in pieces · login by employee code · English-only UI · monorepo/npm workspaces · Prisma · React Native/Expo · tenancy columns present but hardcoded · order line data snapshotted · pricing server-authoritative.

**Prisma superseded 2026-08-18 during Slice A build — see below.**

---

## 2026-08-18 (round 2) — Scope expansion: outlet creation, password reset, real scheme + GST

**Context:** User added four requirements after the round-1 scope was locked: field-created outlets with OTP verification, password reset, GST net of scheme discount, and one hardcoded discount slab rule. Also revealed real catalog size (2,500 SKUs) and "general Android user" framing.

**Conflicts flagged before building:**
- Outlet creation contradicts the source proposal's own permission model (kickoff doc §11: retailer creation is Admin/Manager-only). Built anyway, OTP-gated as the accepted substitute safeguard — logged as a deviation, not treated as equivalent governance.
- "No scheme engine" was a decision Claude recommended and the user accepted in round 1. Reopened by the user's own request. Resolved by implementing the one rule as a plain calculation function rather than building `schemes`/`scheme_slabs` tables — avoids over-engineering for a single rule while flagging that a second rule should trigger the real engine.
- The flat-catalog-list cut (round 1) is reopened: 2,500 SKUs makes a pure flat scroll unusable. Restored a lightweight category filter + search + virtualized list. Flagged explicitly as a reversal rather than left silent.
- "No password reset" was logged in round 1 as an accepted gap beyond the pilot. Now closed.

**Decisions confirmed by user (AskUserQuestion, 2026-08-18):**

| Decision | Answer |
|---|---|
| GST structure | Varies by product — `gst_rate` per product, snapshotted per order line |
| OTP/SMS provider | User will set up an account; Claude defaults to MSG91 behind a swappable adapter, console-log fallback until a real key exists |
| Outlet approval | Live immediately after OTP — no admin approval queue |
| Scale | Still single pilot salesman — security kept at pilot scale, not Play-Store-hardened |

**GST-on-net-of-discount mechanics:** since GST varies by product but the discount is computed at order level, the discount is apportioned across lines proportionally to each line's pretax share, then each line's own GST rate applies to its post-discount amount. Documented in `SFA_MVP_Scope_Locked.md` §6 as a design choice, not an obvious given.

**Account-safety measures added on Claude's own initiative** (user asked generally for account/data safety, did not specify mechanisms): bcrypt/argon2 password hashing; OTP hashed at rest with expiry/attempt caps/resend cooldown; login and OTP rate limiting; account lockout via `failed_login_attempts`/`locked_until` on `employees`; refresh-token revocation via `refresh_token_version`, bumped on password reset; **employee phone number is admin-settable only, never self-service** — closes the loop where a compromised session could redirect password-reset OTPs to itself; generic responses on login/reset endpoints to prevent account enumeration.

**Slices revised:** outlet creation moved into Slice B; scheme+GST calculation and catalog rework moved into Slice C; forgot-password moved into Slice A alongside login.

---

## 2026-08-18 (round 3) — Scheme discount floor confirmed: ₹2,500

**Context:** User's round-2 message read as "if pretax value is 2500 → 2%," which Claude interpreted as a ₹2,500 floor (no discount below it) and locked that way. In round 3, the user restated the rule as "2% up to ₹5,000," which is also consistent with a *no-floor* reading — every order from ₹1 up getting 2%. Genuinely ambiguous between two materially different rules, so Claude asked rather than guessed, given real financial impact on every order under ₹2,500.

**Decision (via AskUserQuestion):** ₹2,500 floor confirmed. Rule stands exactly as locked in round 2: subtotal < ₹2,500 → 0%; ₹2,500–₹5,000 → 2%; > ₹5,000 → 5%. Non-stacking.

**Status:** No calculation change. `SFA_MVP_Scope_Locked.md` §6 updated from "flagged assumption, confirm before Slice C" to "confirmed."

---

## 2026-08-18 (round 4) — Admin employee provisioning: CLI script, not an HTTP endpoint

**Context:** Round 2 had left this as an unconfirmed assumption (endpoint proposed, not agreed). User asked for the tradeoff to be explained before deciding.

**Tradeoff as explained:** a CLI script has no network-reachable path to creating accounts at all — there's nothing to brute-force, no secret to leak, no rate-limiting to get right, because the capability doesn't exist over the network. A protected HTTP endpoint is more convenient (callable from anywhere, no shell access needed) but introduces a standing admin credential — if that credential ever leaks, whoever has it can mint arbitrary salesman logins into a system holding real orders and retailer data.

**Recommendation flipped from round 2:** Claude originally defaulted to the endpoint, assuming the user would want to avoid a terminal. Once the security tradeoff was laid out explicitly, and given the scale is confirmed single-pilot-salesman (decision, round 2), Claude changed its own recommendation to the script — the endpoint's convenience mostly pays off at real multi-account scale, which this isn't yet.

**Decision (via AskUserQuestion):** CLI script. `POST /admin/employees` removed from the API spec; provisioning happens via a script sharing the same service-layer `createEmployee()` function, so promoting to an HTTP endpoint later (if provisioning volume ever justifies it) is additive, not a rewrite.

**Status:** `SFA_MVP_Scope_Locked.md` §2 (decision 15), §7, §12 updated accordingly.

---

## 2026-08-18 — Slice A build: Prisma replaced with pg + node-pg-migrate

**Context:** Mid-build, `prisma migrate dev` failed: `binaries.prisma.sh` returned 403 Forbidden when Prisma tried to download its schema-engine/query-engine binaries. Confirmed with a direct `curl` request (not routing around any restriction, not retried against alternate mirrors) that the domain is blocked by this build sandbox's network policy, while the npm registry itself is reachable.

**Decision:** Swapped the persistence layer to `pg` (node-postgres) + `node-pg-migrate` (plain hand-written SQL migrations). No native binary download required by either.

**Why this was made unilaterally rather than asked as a question:** there was no reasonable alternative that kept Prisma working in this environment, and the substitution changes only an implementation dependency — no schema shape, business rule, or user-facing behavior changed. Asking would have blocked progress on a question the user has no way to unblock (they can't change Anthropic's sandbox network policy either).

**What did NOT change:** the full schema exactly as locked in `SFA_MVP_Scope_Locked.md` §5, translated 1:1 into `apps/api/db/migrations/1755532800000_init.sql`. Repository functions use parameterized raw SQL instead of a generated client — same layering (route → controller → service → repository) as originally planned.

**Portability note:** this constraint is specific to Anthropic's build sandbox. Prisma might work fine wherever this eventually deploys. The switch is being kept regardless, on the grounds that a persistence layer with zero native-binary dependency is more portable and no less "boring/proven" than Prisma for a project of this size — not purely a workaround.

**Status:** `SFA_MVP_Scope_Locked.md` §2 (decision 16), §11 updated. Verified: migration applies cleanly, all 14 tables + `pgmigrations` created correctly in local Postgres.

---

## 2026-08-18 — Slice A complete and verified

**Built:** monorepo scaffold (`apps/api`, `apps/mobile`, `packages/shared`); full Prisma-equivalent schema as a SQL migration; seed script (1 company, 1 distributor, 1 salesman, 1 beat mapped to all 7 weekdays, 8 retailers, 5 brands, 5 categories, 20 products spanning GST rates 5/12/18/28%); OTP adapter (console provider working, MSG91 adapter stubbed pending the user's API key); login with bcrypt + lockout + generic error responses; JWT access/refresh with `refresh_token_version`-based revocation; full forgot-password flow (request/verify/reset); admin employee-provisioning CLI script; Express app with route→controller→service→repository layering and consistent JSON error envelope including rate-limit responses; Expo mobile app with Login + 3-screen Forgot Password flow + placeholder Home screen, wired to the real backend (no mocks).

**Verified, not just written:**
- Backend type-checks cleanly (`tsc --noEmit`, including scripts and seed).
- Full auth flow tested against the real local Postgres database via curl: correct login; generic-error wrong password; generic-error unknown employee code (enumeration-proof); 5-failed-attempt lockout confirmed via direct DB query; locked account still rejects correct password; refresh token rotation works; forgot-password OTP delivered via console provider, wrong OTP rejected, correct OTP accepted, reset succeeds, old password then rejected, new password then accepted, and — critically — the refresh token issued *before* the reset is rejected *after* it (confirms `refresh_token_version` bump actually invalidates old sessions, not just in theory); OTP resend cooldown enforced; rate limiting enforced on login and OTP endpoints, returning the same JSON error envelope as the rest of the API after a fix (initially returned plain text, corrected and re-verified).
- Admin CLI script tested: creates an employee, printed temp password logs in successfully, duplicate employee_code correctly rejected.
- Mobile app type-checks cleanly and bundles successfully for Android via `expo export --platform android` (716 modules, no errors) — the strongest verification available without a physical device attached to this sandbox.

**Known gap, stated plainly:** no physical Android device is attached to this build sandbox, so the actual on-device experience (layout, keyboard behavior, real network conditions) has not been observed directly. `README.md` documents exact steps for the user to run the full stack on their own machine and test via Expo Go on their phone.

**Delivered:** full repo (excluding `node_modules`/build artifacts) as a zip via SendUserFile, plus `docker-compose.yml` for local Postgres setup on the user's machine, plus a root `README.md` covering setup, running on a real phone, and OTP testing without a configured SMS provider.

**Next:** Slice B (today's beat, retailer detail, check-in/close, off-beat search, new outlet creation) — not started, awaiting review of Slice A.
