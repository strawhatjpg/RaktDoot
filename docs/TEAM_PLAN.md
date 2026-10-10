# Team plan — 4 parallel workstreams

Goal: four people build at the same time without blocking each other or causing merge conflicts.

## How parallel work stays conflict-free

1. **Each member owns folders.** Only the owner edits them. Need a change elsewhere? Ask the owner in chat.
2. **Contracts first.** `packages/shared/src/contracts.ts` defines every hand-off (messages, AI output, API shapes, forecast JSON). Code against it from minute one; use mocks until the real piece lands.
3. **One branch per member**, small PRs, merge to `main` at every sync point.
   `m1-bot-ai` · `m2-core` · `m3-forecast-copilot` · `m4-frontend`
4. **Shared files with one owner:** `apps/web/prisma/schema.prisma` and `apps/web/package.json` (M2), `README.md` (M4), `contracts.ts` (M2, changes announced to all).
5. If `package-lock.json` conflicts: take `main`'s version, run `npm install`, commit.
6. Everyone logs Cline usage in `docs/CLINE_USAGE.md` (append your own rows) and records the screen while using Cline.

## Workstreams at a glance

| | Member 1 | Member 2 | Member 3 | Member 4 |
|---|---|---|---|---|
| **Role** | Bot + multilingual AI | Core backend + data | Forecasting AI + Cline Copilot | Frontend + deliverables |
| **Branch** | `m1-bot-ai` | `m2-core` | `m3-forecast-copilot` | `m4-frontend` |
| **Owns** | WhatsApp, simulator logic, AI intake, translation, voice, login via WhatsApp, evals | Next.js scaffold, Prisma DB, seed data, lifecycle, centres, verification, matching, waves, consent, location, reminders, notifications, worker, recognition | Python forecast service, synthetic data, backtest, forecast API, Cline SDK Copilot + tools | PWA, all screens, dashboard UI, push client, README, PPT, demo video, social post |
| **Main AI focus** | Multilingual pillar | Explainable matching (rules) | Prediction pillar + Cline inside product | Presenting AI clearly |

## Folder ownership

| Member | Folders / files |
|---|---|
| M1 | `packages/bot/` (channels, conversation, ai, i18n, WhatsApp login), `evals/multilingual/`, plus the thin route files `apps/web/src/app/api/{whatsapp,simulator,auth}/` once M2's scaffold lands |
| M2 | `apps/web/` scaffold + config, `prisma/`, `src/server/{requests,centres,matching,outreach,donors,consent,reminders,notifications,recognition}/`, `src/server/{db,audit}.ts`, `scripts/worker.ts`, `src/app/api/{requests,centres,donors,outreach,consent,recognition,notifications}/`, `data/seed/`, `packages/shared/src/` |
| M3 | `services/forecast/`, `src/server/forecast/`, `src/server/copilot/`, `src/app/api/{forecast,copilot}/` |
| M4 | `src/app/(public)/`, `(app)/`, `(dashboard)/`, `simulator/` page UI, `src/components/`, `public/` (manifest, service worker, icons), `README.md`, `docs/PITCH_OUTLINE.md`, `docs/DEMO_SCRIPT.md` |

## Timeline (T = start of the 8-hour window)

| Time | Sync point |
|---|---|
| T+0:00–0:15 | **Kickoff:** share keys in a private channel (never in git), confirm `contracts.ts`, create branches, start screen recordings |
| T+0:30 | M2 pushes the empty Next.js app to `main` → everyone pulls |
| T+2:00 | **Sync 1:** merge to `main`; simulator → AI intake → request saved |
| T+4:00 | **Sync 2:** full flow in simulator (request → centres → verify → waves → accept → close) + forecast API live |
| T+5:30 | **Sync 3:** real WhatsApp on phones, Copilot answering, dashboard wired |
| T+6:30 | **Feature freeze:** bugs, tests, labels only |
| T+7:00 | **Code freeze:** deploy, record demo, finish README/PPT |
| T+8:00 | Submit |

---

## Member 1 — WhatsApp bot + multilingual AI

**Mission:** a Hinglish / Hindi / Marathi message or voice note becomes a confirmed, structured request, and every reply comes back in the user's language.

| Time | Task | Done when |
|---|---|---|
| Before T / T+0:15 | Create Meta app + WhatsApp test number; add all 4 team phones as test recipients; get Gemini + Groq free keys | Test message arrives on a phone |
| T+0:15–1:00 | `ai/llm-client.ts` (Gemini primary, Groq fallback on 429), `ai/detect-language.ts`, `ai/normalize.ts` ("B+ve", "बी पॉजिटिव" → `B+`) with tests | Unit tests pass |
| T+1:00–2:00 | `ai/extract-request.ts` → returns `ExtractedRequest` (JSON schema output, validated); `evals/multilingual/cases.jsonl` with 30+ cases | Hinglish sample extracts correctly |
| T+2:00–3:00 | `conversation/bot-flow.ts`: state machine (language pick → role → consent buttons → request intake → follow-up questions → confirm card) calling M2's API; `channels/simulator-adapter.ts` | Works end-to-end in simulator |
| T+3:00–4:00 | `channels/webhook-parser.ts`, `signature.ts`, `whatsapp-client.ts`, `/api/whatsapp/webhook` (verify GET + POST); location pin handling → M2 location API | Real phone conversation works |
| T+4:00–5:00 | `ai/translate.ts` + `packages/shared/i18n/{en,hi,mr}.json` + glossary; `auth/whatsapp-login.ts` ("LOGIN 482913" flow) | Replies in user's language; app login works |
| T+5:00–6:00 | `ai/transcribe.ts` (voice note → Groq Whisper or Gemini audio) | Hindi voice note creates a request |
| T+6:00–7:00 | `evals/multilingual/run-evals.ts` → `results.md` with per-field accuracy | Score ready for README/PPT |

**Depends on:** M2 request + consent + location APIs (use mocks from `contracts.ts` until Sync 1).
**Hands over:** `processInbound(InboundMessage): OutboundMessage[]`, `sendMessage(OutboundMessage)` used by M2 for alerts, eval score to M4.

---

## Member 2 — Core backend + data

**Mission:** the engine — requests, blood-centre-first discovery, verification, smart matching, wave outreach, closed loop, consent, location, reminders.

| Time | Task | Done when |
|---|---|---|
| T+0:00–0:30 | `npx create-next-app apps/web` (TypeScript, App Router), link `@raktdoot/shared`, push to `main` | Everyone can `npm run dev` |
| T+0:30–1:30 | `prisma/schema.prisma` (see `docs/DATA_MODEL.md`), `seed.ts`: 1 city, ~15 real public blood centres with **simulated** stock, ~40 fictional donors, 3 staff accounts | `npx prisma db seed` works |
| T+1:30–2:30 | `/api/requests` (create, get, transition via `checkTransition`), `requests/events.ts`, `centres/discovery.ts` + `/api/centres` | Request created; centres returned with freshness labels |
| T+2:30–3:30 | `requests/verification.ts` + `/api/requests/[id]/verify`; `matching/{filters,score,explain}.ts` → `MatchCandidateDTO[]` with reasons; tests | Ranked donors with explanations |
| T+3:30–4:30 | `outreach/waves.ts`, `stand-down.ts`, `scripts/worker.ts` (wave timers); `notifications/dispatcher.ts` → M1 `sendMessage` / Web Push | Wave 1 → accept → stand-down works |
| T+4:30–5:30 | `consent/consent-service.ts` + `/api/consent`; `donors/location.ts` + `/api/donors/location` (coarsened); availability toggles | Consent + location saved and respected by matching |
| T+5:30–6:30 | `reminders/scheduler.ts` (90/120 days, consent-checked, "skip 90 days" demo endpoint); `recognition/` (badge + certificate on confirmed donation) | Reminder fires in demo |
| T+6:30–7:00 | Tests, deploy web + worker (Render/Railway free tier) | Public URL works |

**Depends on:** nothing at start (critical path, starts first).
**Hands over:** all REST APIs + DB to M1/M3/M4; staff logins for demo.

---

## Member 3 — Forecasting AI + Cline SDK Copilot

**Mission:** strong, honest prediction (ranges + backtest beating a baseline) and Cline running *inside* the product.

| Time | Task | Done when |
|---|---|---|
| T+0:00–1:00 | `services/forecast/` FastAPI skeleton, `requirements.txt`, `data/synthetic_generator.py` (3 yrs weekly; dengue platelet surge, summer dip, festivals, trend, noise) → `data/seed/historical_demand_synthetic.csv` | CSV generated |
| T+1:00–2:30 | `features.py` (lags 1/2/4/52, rolling means, week-of-year, festival flag), `model.py` (seasonal-naive baseline + gradient boosting quantile P10/P50/P90) | Model trains |
| T+2:30–3:30 | `backtest.py` (rolling origin, MAE vs baseline), `risk.py` (shortage probability vs supply), `POST /forecast` returning `ForecastResponse`; pytest | Model MAE < baseline MAE, API live |
| T+3:30–4:00 | `apps/web/src/server/forecast/client.ts` + `/api/forecast` proxy | Next.js returns forecast JSON |
| T+4:00–5:30 | `copilot/agent.ts` with `@cline/sdk` on the free Gemini key; tools: `get_open_requests`, `search_blood_centres`, `rank_donors`, `get_forecast`, `summarize_case`, `draft_outreach_message`; `copilot/approval.ts`; `/api/copilot` | "Which requests are at risk?" returns a grounded answer + drafts |
| T+5:30–6:30 | Daily shortage briefing in the coordinator's language; approved draft → M2 outreach | Approve → campaign sent |
| T+6:30–7:00 | `docs/AI_MODELS.md`: models, features, backtest numbers, limits, "synthetic data" note | Numbers ready for PPT |

**Depends on:** M2 APIs for Copilot tools (mock until Sync 2). Forecast service is fully independent.
**Hands over:** `ForecastResponse` API + Copilot API to M4; backtest chart data and numbers.

---

## Member 4 — Frontend (PWA + dashboard) + deliverables

**Mission:** a clean phone app and staff dashboard, plus everything judges see: README, PPT, demo video, social post.

| Time | Task | Done when |
|---|---|---|
| T+0:00–0:30 | Wireframes for 5 phone screens + 4 dashboard screens; pick UI kit (decide with M2 at kickoff) | Screens agreed |
| T+0:30–2:00 | Phone screens on mock data: Home ("Need blood" / "I want to donate"), New request, Nearby centres (freshness + "simulated" labels), Track request timeline, Donor profile (availability, location update, consent toggles) | Clickable on a phone |
| T+2:00–3:30 | Dashboard: verification queue, case detail (timeline, ranked donors with reasons, wave status, close with outcome), staff login | Works against M2 APIs |
| T+3:30–4:30 | Simulator page UI (WhatsApp-style chat calling M1's `processInbound`); "Log in with WhatsApp" screen | Demo fallback works |
| T+4:30–5:30 | Forecast page (range chart, risk heatmap, backtest vs baseline), Copilot chat page with approve buttons | Shows M3 data |
| T+5:30–6:00 | PWA: `manifest.webmanifest`, `sw.js`, icons, Web Push subscribe → M2 `/api/notifications/push` | Installable; push received |
| T+6:00–8:00 | README (final), PPT (problem, solution, architecture, AI models, Cline usage in build + product, challenges, future scope), `DEMO_SCRIPT.md`, edit demo video from everyone's Cline recordings, social post | Submitted |

**Depends on:** contracts only at start (build on mock JSON); real APIs from Sync 1 onward.
**Hands over:** final submission package.

---

## Demo story (everyone tests against this)

1. Family sends a Hinglish voice/text message on WhatsApp → bot asks for the missing component in Hinglish → confirm card.
2. Nearby centres appear with "simulated stock, updated 20 min ago" labels.
3. Coordinator verifies on the dashboard; stock not confirmed → wave 1 to top 5 ranked donors (reasons visible).
4. A donor accepts with ETA on WhatsApp; others get stand-down after the coordinator confirms enough donors.
5. Centre staff confirms donation → badge + certificate; coordinator closes as FULFILLED.
6. Forecast page: platelet shortage risk in dengue season; Copilot (Cline SDK) drafts a campaign → coordinator approves.
7. "Skip 90 days" → reminder arrives on WhatsApp / app push for a consented donor.

## Before the hackathon starts

- [ ] M1: Meta developer account + app + test number; 4 recipient phones added
- [ ] Everyone: free Gemini key (AI Studio) and Groq key; check limits on each dashboard
- [ ] M2: Render/Railway account
- [ ] M4: slide template, logo, colour palette
- [ ] All: confirm with organisers whether pre-written code is allowed