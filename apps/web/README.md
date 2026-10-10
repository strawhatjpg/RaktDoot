# apps/web

Next.js App Router app: the M4 PWA (families + donors), the staff console, the M2
core API (verification, matching, outreach waves, closed loop, rewards) and the M1
WhatsApp bot wiring. Run `npm.cmd run worker` for reminders and wave timers, and
`npm.cmd run test:demo` for the full end-to-end rehearsal.

## M4 frontend (quick start)

```powershell
npm.cmd install
Copy-Item .env.example .env   # set SESSION_SECRET, DEMO_MODE=true, APP_BASE_URL=http://localhost:3000
npm.cmd run db:generate; npm.cmd run db:migrate; npm.cmd run db:seed
npm.cmd run dev               # http://localhost:3000
# Optional, for the console forecast/briefing:
cd services/forecast; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn main:app --port 8000
```

| Area | Pages |
|---|---|
| Public | `/` landing, `/login` (WhatsApp code or demo account), `/simulator` (same bot engine as the WhatsApp webhook) |
| App (signed in) | `/home`, `/request/new` (AI text/voice intake → nearby centres → confirm), `/requests`, `/track/{id}` (refreshes every 15 s), `/donor` (onboarding, availability, ~1 km location, consents) |
| Console (verified staff) | `/console` briefing, `/console/forecast`, `/console/copilot`, `/console/drafts` (approve/edit/reject) |

M2 pages that live alongside the M4 app: `/dashboard` (verification queue, explained
matches, outreach waves, closing; linked from the console sidebar as "Verify & outreach"),
`/demo` (WhatsApp inbox), `/rewards`, `/r/{code}` (referral), `/terms`.

Auth and bot routes used by the M4 frontend (M1 wiring in `src/server/bot/`, M2 sessions):

| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/whatsapp/start` | → `{ code, link, expiresAt, botConfigured }` + HttpOnly cookie binding the code to this browser. Without `WHATSAPP_BOT_NUMBER`, `link` is null and the code is sent from `/simulator` (dev, or `SIMULATOR_ENABLED=true`) |
| POST | `/api/auth/whatsapp/poll` | `{ code }` → `pending` / `expired` / `confirmed` + session cookie; only the browser that started the login can complete it |
| GET / POST | `/api/auth/demo` | GET lists the demo accounts; POST signs in. **Only** when `DEMO_MODE=true` and not production; same-origin `Origin` = `APP_BASE_URL`; fixed seeded IDs only |
| GET / DELETE | `/api/auth/session` | M2: who am I + configured sign-in methods (Google, WhatsApp, demo) / sign out |
| GET / POST | `/api/auth/me`, `/api/auth/logout` | M4: current user (role, verified, district) / revoke session |
| GET | `/api/auth/google/start?returnTo=` | M2 Google sign-in; the login page shows it only when configured |
| POST | `/api/simulator` | `{ from, text \| buttonId \| location }` → bot replies (same bot as the webhook) |
| POST | `/api/intake/extract` | `{ text }` → M1 extraction (rules; LLM when Gemini/Groq keys are set) |
| POST | `/api/requests/{id}/close` | Requesters may cancel from `/track/{id}`; staff close as FULFILLED |

Without `WHATSAPP_BOT_NUMBER`, "Log in with WhatsApp" hands the code to `/simulator`.
Without Gemini/Groq keys, the Copilot page shows a setup message; everything else still works.
Styling is plain CSS in `src/app/styles/` (no UI framework).

## Setup (from repository root, PowerShell)

```powershell
npm.cmd install
Copy-Item .env.example .env
# Edit .env: set DEMO_MODE=true for local synthetic fixtures only.
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run demo:session -- demo-requester
npm.cmd run dev
```

The seed is idempotent and creates 2 fictional hospitals, 15 fictional centres,
40 fictional donors and 3 staff users. No routable phone numbers, real personal
data or default passwords are seeded. These are not verified public listings.

The CLI prints a temporary bearer token; keep it private. There is no trusted
`x-user-id` header. Real sign-in is the WhatsApp login code (M1 proof → `createSession`).
The demo-login endpoint above is local-demo only (`DEMO_MODE=true`, non-production,
same-origin). The CLI and seed refuse production mode and require explicit `DEMO_MODE=true`.

## Available routes

| Method | Route | Access |
|---|---|---|
| GET | `/api/centres` | Public hospital choices |
| GET | `/api/centres?hospitalId=demo-hospital-1&bloodGroup=B%2B&component=PACKED_RED_CELLS` | Public same-district discovery |
| POST | `/api/requests` | Session + `Idempotency-Key` required |
| GET | `/api/requests` | Session; latest 50 **own** requests only |
| GET | `/api/requests/{id}` | Owner or verified, scoped staff |
| GET | `/api/consent` | Session; own latest consent per purpose/channel + current terms version |
| POST | `/api/consent` | Session; append consent grants/withdrawals |
| GET / PUT | `/api/donors` | Session; own donor profile only (PUT creates 201 or updates 200) |
| PUT | `/api/donors/availability` | Session; AVAILABLE / PAUSED / UNAVAILABLE(+end date) |
| PUT / DELETE | `/api/donors/location` | Session + LOCATION_STORAGE consent; stored at ~1 km |
| POST | `/api/forecast` | Verified staff (M3). Body `ForecastQuery` → `ForecastResponse` (synthetic) |
| GET | `/api/forecast/backtest?district=Pune` | Verified staff (M3). Model vs baseline per week (chart) |
| GET | `/api/copilot/briefing?district=Pune` | Verified staff (M3). Deterministic shortage briefing, no LLM |
| POST | `/api/copilot` | Verified staff (M3). `{ question }` → `{ text, provider, toolsUsed, draftIds, drafts }` |
| GET | `/api/copilot/drafts?status=PENDING_APPROVAL` | Verified staff (M3). Copilot drafts |
| POST | `/api/copilot/drafts/{id}` | COORDINATOR/ADMIN (M3). `{ action: "approve" \| "reject" \| "edit", note?, message? }` |

### Forecast + Copilot (M3)

Needs the forecast service running (`cd services/forecast && .venv/bin/uvicorn main:app --port 8000`)
at `FORECAST_SERVICE_URL`. `/api/copilot` also needs `GEMINI_API_KEY` + `GEMINI_MODEL` (or Groq) in `.env`;
without them it returns 503 `AI_NOT_CONFIGURED`, while the briefing, forecast and drafts still work.

The Copilot reads the signed-in staff member's cases through M2's access rules (Pune coordinator sees
Pune cases only; centre staff see none until case assignments exist). It can only create **drafts**;
approval is coordinator-only and re-checks verification. Approved drafts are logged, not sent, until
M2's outreach exists (`onApproved` in `src/server/copilot/index.ts`). Drafts live in memory per process.
`rank_donors` returns nothing until M2's matching runtime lands. `COPILOT_DATA_SOURCE=mock` switches to
the simulated demo cases from `packages/copilot` (useful for a demo without seeded requests).
Errors use the same `{ error: { code, message } }` shape: 503 `FORECAST_UNAVAILABLE`, 429 `AI_RATE_LIMITED`.

### Consent and donor examples

```json
POST /api/consent
{ "termsVersion": "2026-10-v1", "updates": [
  { "type": "TERMS", "channel": null, "granted": true },
  { "type": "URGENT_ALERTS", "channel": "WHATSAPP", "granted": true },
  { "type": "LOCATION_STORAGE", "channel": null, "granted": true } ] }

PUT /api/donors
{ "bloodGroup": "O-", "sex": "FEMALE", "travelRadiusKm": 10, "ageConfirmed": true }

PUT /api/donors/availability
{ "availability": "UNAVAILABLE", "unavailableUntil": "2030-01-10T00:00:00.000Z" }

PUT /api/donors/location
{ "lat": 18.5204, "lng": 73.8567, "source": "APP_GPS", "areaLabel": "Shivajinagar" }
```

Consent rules: `termsVersion` must match the notice shown (409 otherwise). Other
purposes need accepted terms. `URGENT_ALERTS` and `DONATION_REMINDERS` are per channel.
`CONTACT_SHARING` is rejected here; it will be granted per request on acceptance.
Withdrawing terms withdraws all purposes, deletes location and pauses the donor.
Withdrawing location storage deletes the stored location immediately.

Donor rules: registration requires accepted terms and age confirmation; new donors
start PAUSED. Expired UNAVAILABLE is reported as PAUSED (never silently AVAILABLE).
Self-reported last donation can only move forward. `provisionalNextReviewAt` is a
whole-blood reminder date, not a medical eligibility decision. Location must be in
India; the web API accepts APP_GPS / MANUAL_ENTRY only (WhatsApp pins come via M1).

Example POST body (use a future date, canonical UTC ISO with milliseconds):

```json
{
  "hospitalId": "demo-hospital-1",
  "bloodGroup": "B+",
  "component": "PACKED_RED_CELLS",
  "units": 2,
  "neededBy": "2030-01-02T12:00:00.000Z",
  "language": "hi-Latn",
  "confirmed": true
}
```

Headers: `Content-Type: application/json`, `Authorization: Bearer <private token>`,
`Idempotency-Key: <unique action ID, 8–128 safe characters>`.

Cookie sessions use HttpOnly, SameSite=Lax, and Secure in production. Cookie-authenticated
mutations require Origin to match APP_BASE_URL. Raw tokens are never stored in the DB.

## Validation

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run test:integration
npm.cmd run build
npm.cmd run test:smoke
```

Integration tests create, migrate and seed a unique temporary database; they never
reset the developer database. They invoke real route handlers and the Prisma layer.
The smoke test launches the production build on a temporary local port, checks real
HTTP responses, then stops the process and removes its isolated database.

## Important limits

- No external messaging or AI calls are made by this milestone.
- No rate limiter or full user-facing privacy/deletion flow yet: not ready for public production use.
- Database is SQLite. PostgreSQL requires deliberate migration work, not a URL-only switch.
- Discovery is bounded to 100 centres in the hospital's district and uses straight-line distance.
- Stock timestamps are returned without asserting availability or making reservations.
- Request creation requires all critical fields and explicit confirmation; unfinished intake stays with M1.
- General case transitions and fulfilment are intentionally not exposed until evidence/authorization checks exist.
- Staff privileges are scoped; blood-centre staff need explicit future case assignments for private-case access.
- Clinical screening, deferrals and donation-method eligibility remain future work.