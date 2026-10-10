# apps/web

Next.js App Router scaffold and Member 2 core API. The PWA screens, WhatsApp login,
verification actions, matching, waves, reminders and worker are **not implemented yet**.

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

The CLI prints a temporary bearer token; keep it private. There is deliberately
no public demo-login endpoint or trusted `x-user-id` header. M1 must integrate
identity proof with the server-only `createSession` helper. The CLI and seed refuse
production mode and require explicit `DEMO_MODE=true`.

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