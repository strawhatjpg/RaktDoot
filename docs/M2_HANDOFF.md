# Member 2 — first milestone handoff

## Contract additions (announce to all members before merge)

Existing interfaces are preserved. Additions: `CreateBloodRequestInput`,
`ApiErrorDTO`, `HospitalDTO`, `RequestEventDTO`, `BloodRequestDetailDTO`,
`ActorContext`, runtime request validation, and scoped access predicates.
`CentreResultDTO.isSimulated` and `BloodRequestDTO.isSimulated` are optional for backwards compatibility; the new
backend always emits it. Frontends must display it even when there is no stock.

### M1

- Resolve a hospital ID using the public hospital listing, then submit user-confirmed intake.
- Convert the confirmed deadline to `Date.toISOString()`. Preserve group/component exactly.
- POST requires an Idempotency-Key: use a stable ID for a single confirmation action.
- Same key + same body returns 200/replayed; same key + changed body returns 409.
- Identity comes from a server-created session, never from request body or sender-supplied role.
- `createSession(userId)` is server-only; call only after successful identity proof.
  `sessionCookie` formats the HttpOnly cookie for your login route.
- No auth routes in M1's folder were implemented or overwritten. Session helper ownership is proposed M2.
- Consent/location APIs are next; schema exists, but do not claim those endpoints are available.

### M3

- Core types remain compatible. Authenticated case detail is available.
- Own-request listing is not a coordinator queue. Scoped queue/tool access comes in the next milestone.
- Forecast/Copilot dependencies and implementation remain your responsibility.
- Seed generator ownership: M2 owns the core seed; M3 owns demand-history generation.

### M4

- Root layout/home are minimal scaffold only, ready for frontend handoff.
- Public centre endpoint without query returns hospital choices; filtered call returns centres.
- URL-encode blood-group `+` as `%2B` (use URLSearchParams).
- Empty phone string means no public number; do not render a call action.
- Auth errors: 401. Inaccessible/missing case: 404. Validation: 400 with field map.
- Request detail returns `{request, events}`. POST returns `{request, replayed}`.
- The initial event starts at null because conversational drafts are not persisted in this milestone.
- Do not show private patient data in frontend logs or expose donor identity publicly.
- README ownership remains M4; update root status to reflect this milestone after integration.

## Decisions deliberately deferred

Pilot city approval (seed geography is synthetic Pune), real directory verification,
production database/hosting, M1 login proof, staff assignment model, consent endpoints,
verification queue, wave jobs/outbox, commitments and units-issued evidence, reminders,
recognition, and external transport. No unfinished placeholder implementations were
added for these features.

## Follow-up priority

1. Consent + donor/location APIs and matching runtime validation.
2. Staff verification with evidence and institutional scope.
3. Matching, durable wave jobs, and concurrent commitment protection.
4. Separate donation confirmation and fulfilment/issuance records before closure APIs.
5. Reminder consent recheck, idempotent recognition, deployment and security hardening.

Future database changes must use migrations. All prototype data is synthetic.

## Milestone 2 — consent, donor profile, availability, location

Endpoints: `GET/POST /api/consent`, `GET/PUT /api/donors`, `PUT /api/donors/availability`,
`PUT/DELETE /api/donors/location`. Request/response examples are in `apps/web/README.md`.

New shared exports: `ConsentUpdateInput`, `ConsentStateDTO`, `DonorRegistrationInput`,
`AvailabilityUpdateInput`, `DonorProfileDTO`, `DonorLocationDTO`, `AVAILABILITY_STATES`,
`CURRENT_TERMS_VERSION`, `MAX_TRAVEL_RADIUS_KM`, `effectiveAvailability`, and validators
`validateConsentUpdate`, `validateDonorRegistration`, `validateAvailabilityUpdate`,
`validateLocationUpdate`. `ConsentRecord.sequence` (optional) breaks same-timestamp ties.

Migration `202610100002_donor_last_donation_source` adds a nullable column only.

### M1 (bot)

- Call the server functions directly from the verified webhook, not via HTTP:
  `updateConsents(actor, body, "WHATSAPP")` and
  `updateDonorLocation(actor, body, ["WHATSAPP_SHARE"])` for location pins.
- Show the terms notice, then send `termsVersion: CURRENT_TERMS_VERSION`. A 409
  `TERMS_VERSION_CHANGED` means re-show the notice.
- "STOP" should withdraw the relevant channel consent; "DELETE MY DATA" is not built yet.

### M4 (frontend)

- Donor profile screen: `GET /api/donors` (404 `DONOR_NOT_REGISTERED` → show registration).
- Display `effectiveAvailability`, and `location.needsUpdate` as a gentle prompt.
- Present `provisionalNextReviewAt` as "you may be eligible again from", never "eligible".
- Toggle UI posts only changed consents; each channel is a separate toggle.

### Not yet built (next milestones)

Staff verification queue, matching, waves, request-scoped contact sharing,
reminders, recognition, and data deletion.

> **Update — milestones 3–9 are now built.** See "Milestones 3–9" below.

## Milestones 3–9 — bot integration, OAuth, verification, matching, waves, closed loop

Migration `202610100003_outreach_auth_fulfilment` adds `User.email`, `OAuthAccount`,
`BotConversation`, `OutreachWave`, `OutreachInvite`, `Notification` (durable outbox),
`FulfilmentRecord`, `RecognitionAward`, `ReminderLog`, plus `BloodRequest.verifiedById /
verifiedAt / acceptedCount` and `RequestEvent.kind / note`. SQLite rebuilds the two
altered tables (Prisma's standard approach; data is copied).

| Milestone | What exists | Key files |
|---|---|---|
| M3 bot ↔ backend | `createPrismaCoreApi` replaces M1's mock: conversation state in DB, WhatsApp consents via `updateConsents`, donor sign-up, location pins (held until consent/profile exist), hospital-name resolution, idempotent requests, invite replies, STATUS, DELETE MY DATA. `BOT_CORE=mock` restores the mock. | `src/server/bot/core-adapter.ts`, `src/server/bot/index.ts` |
| Google OAuth | Authorization-code flow + PKCE S256 + `state` cookie; links by Google `sub`, then verified email; always REQUESTER. Plus `GET/DELETE /api/auth/session` and dev-only demo sign-in. | `src/server/auth/oauth.ts`, `src/app/api/auth/{google,session,demo}` |
| M4 verification | Scoped queue + verify/reject with method, verifier and time recorded | `GET /api/verification`, `POST /api/requests/{id}/verify` |
| M5 matching | Pure, explained ranking: exact group, WhatsApp alert consent, effective availability, fresh location (≤90 days), radius, donation interval, not committed/invited, not the requester. ETA weight folded into distance (ETA unknown before acceptance). | `packages/shared/src/matching.ts`, `GET /api/requests/{id}/matches` |
| M6 waves | 5 donors/10 km → 10/25 km → 15/50 km; WhatsApp buttons Accept / Ignore / Pause alerts; atomic slot claim (`acceptedCount < units`); request-scoped CONTACT_SHARING on accept; stand-down when full or closed; expiry by worker | `src/server/outreach/service.ts`, `POST /api/requests/{id}/outreach` |
| M7 closed loop | ARRIVED / DONATED / DEFERRED / NO_SHOW per donor; units issued recorded separately; FULFILLED requires issued ≥ requested; requesters may only cancel | `POST /api/invites/{id}/outcome`, `/fulfilment`, `/close` |
| M8 notifications + reminders | Durable outbox with dedupe keys, conditional claim, 3 retries; real WhatsApp send when configured, otherwise SIMULATED; fictional donors always SIMULATED; reminders once per due date with consent re-checked | `src/server/notifications/`, `src/server/reminders/service.ts`, `scripts/worker.ts` |
| M9 recognition + deletion | One certificate per confirmed donation (unique per invite); DELETE MY DATA erases identity, consent, location, sessions, OAuth links | `outreach/service.ts`, `bot/core-adapter.ts` |
| Copilot (M3 hand-off) | `rankDonors` now returns real scoped matches; approving a DONOR_OUTREACH draft starts a real wave as the approving coordinator | `src/server/copilot/{data-source,index}.ts` |
| UI for the demo | `/`, `/login`, `/request`, `/track/{id}`, `/donor`, `/dashboard`, `/demo` (WhatsApp inbox), `/terms` | `src/app/**/page.tsx` |

Validation: 91 unit tests, 39 integration tests (incl. concurrent accepts, STOP,
rejection, retries, reminders, deletion, OAuth), typecheck, production build, HTTP smoke,
and `npm run test:demo` (the full demo story over HTTP) all pass. See `docs/DEMO.md`.

Known limits: the bot's location-request flow cannot tell a typed area from a pin
with lat/lng 0,0 (M1 sends `{lat:0,lng:0}` for typed areas); the adapter treats 0,0 as
"typed area" and resolves it against seeded hospital names only, so typed areas outside
the directory are labelled but not stored as coordinates. Donation campaigns from the
Copilot are recorded but not sent (they need their own consent purpose).

## Milestone 10 — coins, referrals and sponsor coupon store

Revised policy: `docs/REWARDS_POLICY.md`. Gate: `FEATURE_TOKEN_REWARDS=true`.
Migration `202610100004_rewards` adds `Wallet`, `CoinEntry` (append-only ledger),
`ReferralCode`, `Referral`, `Sponsor`, `StoreItem`, `CouponCode`, `Redemption` (new tables only).

| Piece | Behaviour | Where |
|---|---|---|
| Earning | 100 coins per **centre-confirmed** donation; 25 to a referrer when the referred person registers as a donor; +50 on their first confirmed donation. Idempotent (unique `refKey`). Referral cap 10 per 30 days. | `src/server/rewards/service.ts` (hooked into `recordDonorOutcome`, `upsertDonorProfile`, WhatsApp `updateDonor`) |
| Referrals | `/r/<code>` landing page → *Join on WhatsApp* (prefilled `JOIN <code>`, recorded from the signed webhook or simulator) or *Sign up in the app* (code kept in localStorage, attached after sign-in). New accounts only (24 h), once, not self. | `src/app/r/[code]`, `src/server/bot/{index,core-adapter}.ts`, `POST /api/rewards/referral` |
| Store | Sponsor items with coupon codes; redemption debits (`balance >= cost`) and claims one unused code in one transaction; Idempotency-Key; per-user limit. Admin adds items and codes. | `GET /api/rewards/store`, `POST /api/rewards/redeem`, `POST /api/admin/store-items` |
| Wallet | Balance, history, referral link + stats, my coupon codes | `GET /api/rewards`, `/rewards` page |
| Seed | 3 fictional sponsors × 20 demo codes (`DEMO-CAFE-0001`…) | `prisma/seed.ts` |

**M1 note:** the WhatsApp webhook route (M1-owned) now also calls `recordReferralsFromWebhook`
after signature verification; the bot flow itself is unchanged ("JOIN …" just starts onboarding).

Validation: 94 unit tests, 47 integration tests (incl. concurrent redemptions, referral
abuse cases, ledger = balance), typecheck, build, smoke and the demo rehearsal (now with
referral → donation → coins → coupon) pass.

## Merge notes for `main` (checked against origin branches on 2026-10-10)

`m2-core` merges cleanly with `main`. Against `m1-bot-ai` (b3ef86a) and
`m3-forecast-copilot` (8361a9e) the **only** conflicts are the root `package.json`
and `package-lock.json`, because all three branches edit the same `scripts` block.
No source files overlap. Suggested order: merge `m2-core` first (it adds the
`apps/*` workspace the others plug into), then resolve each later branch like this:

1. `package.json`: keep the union. Combined `scripts` should be:
   - `test`: `node --test "packages/shared/tests/*.test.ts" "packages/bot/tests/*.test.ts" "packages/copilot/tests/*.test.ts"`
   - `typecheck`: `tsc -p packages/shared/tsconfig.json && tsc -p packages/bot/tsconfig.json --types node && npm run typecheck -w @raktdoot/copilot && npm run typecheck -w @raktdoot/web`
   - keep M2's `dev`, `build`, `start`, `db:*`, `demo:session`, `test:integration`, `test:smoke`
   - keep M1's `evals`, `evals:ai`, `bot:chat`; keep M3's `test:forecast`, `copilot:demo`
   - `devDependencies`: one `@types/node` range for everyone (M1/M3 use `^22.20.5`, M2 used `^24.0.0`; Node ≥22.18 is the engine floor, so `^22.20.5` is the safer shared choice) and `typescript` `~5.9.3`.
2. `package-lock.json`: per TEAM_PLAN rule 5, take `main`'s version, run `npm install`, commit.
3. Run `npm test`, `npm run typecheck`, `npm run test:integration`, `npm run build`.

### Integration with M1's `CoreApi` (packages/bot/src/core-api.ts)

M1's bot runs on an in-memory mock keyed by phone number. The real adapter
(phone → user lookup/creation, then these services) is M2's next integration task:
`recordConsent` → `updateConsents(actor, …, "WHATSAPP")`, `updateLocation` →
`updateDonorLocation(actor, …, ["WHATSAPP_SHARE"])`, `updateDonor` → `upsertDonorProfile`,
`createRequest` → `createBloodRequest` (needs hospital name → `hospitalId` resolution and
an idempotency key from the WhatsApp message ID). M1's mock accepts `component` and
`neededBy: null` values that the real API rejects; the bot must ask for both before confirming.

## Dependency security follow-up

Audit on 2026-10-10 reports GHSA-ggr8-5vv4-36mx in Prisma 6's transitive
`deepmerge-ts@7.1.5` dependency (three high-severity package findings along the
same dependency chain). The advisory requires recursive JavaScript object graphs;
plain JSON alone does not create the condition. The application does not feed
request input into Prisma configuration merging, but this is not a clean audit.
Resolve with a supported, tested Prisma/dependency upgrade before production.
Do not blindly run `npm audit fix --force`: its proposed Prisma downgrade crosses
the configured version range. A trial root override did not change npm's resolved
workspace dependency, so it was removed rather than claim the issue was fixed.

## Validation results

Validated locally on Windows / Node 24.12.0:

- 24 shared tests passed.
- 13 API/database/HTTP-helper tests passed using isolated temporary SQLite databases.
- Prisma schema validation, client generation and initial migration succeeded.
- Seed executed twice without duplication; no routable phone numbers were created.
- Strict TypeScript checks passed for shared and web packages.
- Next.js production build succeeded.
- Production HTTP smoke passed for the home page, database-backed discovery and protected request endpoint.
- `git diff --check` passed.
- Dependency audit is **not clean**; see the advisory above.

No deployment, real WhatsApp login, external messaging, AI or forecasting claims are made.
CI is configured but has not yet run on GitHub.

## Cline usage log (M2)

Kept here instead of `docs/CLINE_USAGE.md` to avoid same-line merge conflicts with
other members' rows. Copy into the shared log when branches are merged to `main`.

| Phase | What Cline did | Output |
|---|---|---|
| M2 foundation | Reviewed all 38 files; created m2-core, app scaffold, runtime validation, scoped access, Prisma migration, synthetic seed and session-backed create/read/discovery APIs | 24 shared + 13 API/DB tests; typecheck, production build and HTTP smoke passed |
| M2 consent + donors | Consent, donor profile, availability and coarsened location services/APIs; terms-version check, cascading withdrawal, migration with drift check | 30 shared + 21 API/DB tests; typecheck, build and smoke passed |