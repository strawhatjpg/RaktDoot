# RaktDoot — from blood request to confirmed response

> WhatsApp-first blood access coordination for India. Built for the **Cline AI Builder Hackathon (Round 2)**.

**Status:** foundation stage. Shared domain rules are implemented and tested; the app, bot and forecast service are built in the coding phase (see [`docs/ROADMAP.md`](docs/ROADMAP.md)).

## Problem

When a patient needs blood urgently, families often turn fragmented listings, uncertain stock information and forwarded donor appeals into dozens of phone calls. Registered donor lists go stale, appeals keep circulating after they are resolved, and most tools assume English literacy and a form-filling mindset. Existing infrastructure such as eRaktKosh lists blood centres and stock; RaktDoot complements it with **coordination**: it does not replace it.

## Solution

| Capability | What it does |
|---|---|
| WhatsApp bot + installable mobile web app (PWA) | Same backend, two front doors. WhatsApp is primary. |
| Multilingual AI intake | Hindi / English / Hinglish (+1 regional language) text and voice → structured, confirmed request. Replies in the user's language. |
| Blood-centre-first discovery | Nearby centres with component stock labelled **reported / confirmed / reserved** and an "updated X min ago" time. |
| Verified requests + smart donor matching | Hospital staff or a coordinator verifies a request; explainable donor ranking follows. |
| Wave outreach + closed-loop tracking | Small donor batches, escalation, stand-down messages, and staff-only case closure. |
| Manual location updates | Donors update their location any time (WhatsApp location pin, app GPS, or typed area). Stored at ~1 km precision. |
| In-chat consent + reminders | Separate opt-in buttons per purpose; provisional 90/120-day reminders via WhatsApp or app push. |
| Area demand forecasting | Weekly demand ranges per district × blood group × component, backtested against a seasonal baseline. |
| Coordinator Copilot (Cline SDK) | AI agent that uses our tools to brief coordinators and draft outreach. **A person approves every action.** |
| Recognition (non-monetary) | Certificates, badges and a donor journey. Token rewards stay **disabled** pending official guidance. |

All donor coordination leads to a **licensed blood centre**. RaktDoot never facilitates person-to-person collection and never makes clinical decisions.

## Who uses it

See [`docs/USER_ROLES.md`](docs/USER_ROLES.md). In short: **anyone** can request blood and see nearby centres instantly. **Contacting private donors** requires the request to be verified by hospital staff, blood centre staff or a coordinator.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/PIPELINES.md`](docs/PIPELINES.md).

## Tech stack (planned)

- **Web app + API:** Next.js (TypeScript), PWA manifest + service worker, Web Push
- **Database:** Prisma + SQLite (local) → PostgreSQL (deployed)
- **Messaging:** WhatsApp Cloud API, with a built-in simulator as a demo fallback
- **AI:** LLM API for multilingual extraction/translation, speech-to-text for voice notes, Cline SDK for the Copilot
- **Forecasting:** Python FastAPI + scikit-learn (gradient boosting with quantiles)

## Repository layout

```
packages/shared/      Domain rules shared by bot, app and API (implemented + tested)
apps/web/             Next.js app, API routes, bot logic, worker (coding phase)
services/forecast/    Python demand forecasting service (coding phase)
evals/multilingual/   Accuracy test set for the multilingual intake
data/seed/            Demo centres, donors, synthetic history
docs/                 Architecture, pipelines, data model, policies, build log
.clinerules/          Project rules Cline follows during the build
```

## Setup

Requirements: **Node.js 22.18+** (runs TypeScript tests natively) and **Python 3.11+** (forecast service).

```bash
npm test          # runs shared domain tests (no install needed yet)
cp .env.example .env
```

Full setup steps are added as each component lands.

## How Cline was used

Tracked live in [`docs/CLINE_USAGE.md`](docs/CLINE_USAGE.md): ideation, problem-statement review, feasibility checks, repository scaffolding and tests were all done with Cline. Cline also runs **inside** the product as the Coordinator Copilot (Cline SDK).

## Safety and privacy

See [`docs/SAFETY_PRIVACY.md`](docs/SAFETY_PRIVACY.md) and [`docs/REWARDS_POLICY.md`](docs/REWARDS_POLICY.md).

## License

MIT