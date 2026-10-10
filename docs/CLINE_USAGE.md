# How Cline was used

A running log for the README, PPT and demo video. Add an entry after each meaningful step; keep screenshots in `docs/screenshots/`.

| # | Phase | What Cline did | Output |
|---|---|---|---|
| 1 | Ideation | Reviewed the blood donation idea, checked eRaktKosh and WhatsApp policies, proposed a coordination-first framing | Problem statement + feature shortlist |
| 2 | Ideation | Read the hackathon brief PDF, checked feasibility (WhatsApp location, opt-in, 24 h window, Cline SDK, donor gift rules) | Verified feature table, pipelines |
| 3 | Planning | Reworked plan per team decisions (manual location, in-chat consent, rewards policy, roles) | `docs/ROADMAP.md`, `USER_ROLES.md`, `REWARDS_POLICY.md` |
| 4 | Scaffold | Created repository, `.clinerules`, shared domain rules and 16 passing tests | `packages/shared` |
| 5 | Build (M1) | Built the WhatsApp bot + multilingual AI package: conversation flow, Gemini→Groq client, extraction with validation, i18n (en/hi/hi-Latn/mr), voice transcription, webhook + signature, WhatsApp login, 32-case eval (98.8% rules-only) | `packages/bot`, `evals/multilingual` |
| 5b | Build (M2) | Reviewed all 38 files; created m2-core, app scaffold, runtime validation, scoped access, Prisma migration, synthetic seed and session-backed create/read/discovery APIs (copied from `docs/M2_HANDOFF.md`) | 24 shared + 13 API/DB tests; typecheck, production build and HTTP smoke passed |
| 5c | Build (M2) | Consent, donor profile, availability and coarsened location services/APIs; terms-version check, cascading withdrawal, migration with drift check (copied from `docs/M2_HANDOFF.md`) | 30 shared + 21 API/DB tests; typecheck, build and smoke passed |
| 6 | M3 Forecast | Built FastAPI forecast service: synthetic 3-year generator, leakage-free features, quantile gradient boosting vs seasonal-naive, rolling-origin backtest, shortage risk, explainable drivers, contract-matching `/forecast`; 31 pytest tests. Model beats baseline by 23–28% MAE (synthetic) | `services/forecast/`, `data/seed/historical_demand_synthetic.csv` |
| 7 | M3 Copilot | Read `@cline/sdk` 0.0.92 type definitions, verified `Agent`/`createTool`/tool policies with an offline scripted model, then built the Coordinator Copilot: 6 read/draft tools, coordinator-only approval store with safety re-check, reviewed templates, Gemini→Groq fallback, deterministic shortage briefing, typed forecast client, ready-to-copy Next.js routes, Render deploy, `docs/AI_MODELS.md`; 30 offline tests | `packages/copilot/`, `docs/AI_MODELS.md`, `render.yaml` |
| 8 | M3 Integration | Merged M1 + M2 branches into M3, resolved scripts/lockfile per M2's handoff, wired forecast + Copilot routes into Next.js with M2's sessions, error shape and access scoping (DB-backed Copilot data source), per-request scoped approval store; 4 new DB integration tests; verified live: Next.js → forecast service with a coordinator session | `apps/web/src/app/api/{forecast,copilot}`, `apps/web/src/server/{forecast,copilot}` |

## Cline inside the product

Coordinator Copilot built with `@cline/sdk` custom tools (see `docs/PIPELINES.md` § F).