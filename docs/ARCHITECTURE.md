# Architecture

```
 Family / Donor            Donor / Family            Staff / Coordinator
   WhatsApp                 PWA (phone)                Dashboard
      │                         │                          │
      ▼                         ▼                          ▼
 WhatsApp Cloud API ──▶ ┌──────────────────────────────────────────┐
   (webhook)            │ Next.js app (apps/web)                    │
                        │  UI pages · API routes · Simulator        │
                        └───────────────┬──────────────────────────┘
                                        ▼
 ┌──────────────────────── Core services (TypeScript) ──────────────────────┐
 │ Conversation flow │ Auth + roles │ Consent │ Request lifecycle            │
 │ AI intake (detect · extract · normalise · translate · transcribe)       │
 │ Centre discovery │ Verification queue │ Matching │ Wave outreach         │
 │ Location updates │ Reminders │ Notifications (WhatsApp + Web Push)       │
 │ Recognition │ Audit log │ Coordinator Copilot (Cline SDK + our tools)    │
 │ Shared rules: packages/shared                                             │
 └──────┬─────────────────────┬──────────────────────────┬──────────────────┘
        ▼                     ▼                          ▼
   Prisma DB            Forecast service           LLM + speech-to-text
   (SQLite→Postgres)    (Python FastAPI)           providers
        ▲
   Worker process: wave timers · reminders · location refresh prompts · nightly forecast
```

## Hosting

Wave timers and reminders need a long-running worker, so deploy on Render or Railway (web + worker + forecast service), not a purely serverless host.

## Planned file tree

```
apps/web/
  prisma/schema.prisma, seed.ts
  public/manifest.webmanifest, sw.js, icons/
  scripts/worker.ts
  src/app/
    (public)/page.tsx, terms/, privacy/
    (app)/login/, request/new/, track/[caseId]/, centres/, donor/, donor/location/, recognition/
    (dashboard)/coordinator/, coordinator/[caseId]/, verify/, forecast/, copilot/, partners/
    simulator/
    api/whatsapp/webhook/, auth/, requests/, requests/[id]/verify/, centres/, donors/,
        donors/location/, outreach/, consent/, notifications/push/, recognition/,
        forecast/, copilot/
  src/server/
    channels/      whatsapp-client.ts, webhook-parser.ts, signature.ts, templates.ts,
                   simulator-adapter.ts, channel.ts
    conversation/  bot-flow.ts, handlers/{request,donor,login,consent,location}.ts
    ai/            llm-client.ts, detect-language.ts, extract-request.ts, normalize.ts,
                   translate.ts, transcribe.ts, prompts/
    copilot/       agent.ts, tools/*.ts, approval.ts
    requests/      lifecycle.ts, verification.ts, events.ts
    centres/       discovery.ts, freshness.ts
    matching/      filters.ts, score.ts, explain.ts
    outreach/      waves.ts, stand-down.ts
    donors/        availability.ts, location.ts
    notifications/ dispatcher.ts, web-push.ts
    reminders/     scheduler.ts
    recognition/   badges.ts, certificates.ts
    auth/          whatsapp-login.ts, session.ts, roles.ts
    consent/       consent-service.ts
    forecast/      client.ts
    db.ts, audit.ts
services/forecast/
  app/main.py, schemas.py, features.py, model.py, risk.py, backtest.py
  data/synthetic_generator.py
  tests/, requirements.txt
data/seed/  blood_centres_<city>.json, donors_demo.json, historical_demand_synthetic.csv
evals/multilingual/  cases.jsonl, run-evals.ts, results.md
```