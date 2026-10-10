# @raktdoot/copilot

Coordinator Copilot built with the **Cline SDK** (`@cline/sdk`), plus the typed client for the forecast
service. Framework-free: it runs in the demo CLI and in the Next.js app, which wires it to M2's sessions
and DB in `apps/web/src/server/copilot/` and exposes `/api/forecast*` and `/api/copilot*`
(see `apps/web/README.md`).

Details and guardrails: [`docs/AI_MODELS.md`](../../docs/AI_MODELS.md) § 2.

## Try it (no Next.js needed)

```bash
# 1. forecast service (separate terminal)
cd services/forecast && .venv/bin/uvicorn main:app --port 8000

# 2. from the repo root
npm install
npm run copilot:demo -- briefing Pune        # deterministic shortage briefing, no LLM key
npm run copilot:demo -- approve-demo         # shows the human-approval gate, no LLM key
npm run copilot:demo -- ask "Which requests are at risk today?"   # needs a free LLM key
```

For `ask`, put these in the repo-root `.env` (never commit it): `GEMINI_API_KEY` and `GEMINI_MODEL`
(a current free Flash model from AI Studio). Optionally add `GROQ_API_KEY` and `GROQ_MODEL` as the fallback.
Requests, centres and donors are **simulated** (`src/mock-data.ts`) until M2's APIs exist.

## Modules

| File | Purpose |
|---|---|
| `forecast-client.ts` | `createForecastClient` / `forecastClientFromEnv`: timeout, zod-validated query + response, `ForecastServiceError` |
| `schemas.ts` | zod schemas matching `contracts.ts` (forecast) + JSON-schema conversion for tools |
| `data-source.ts` | `CopilotDataSource` interface (**M2 implements it** against the DB) |
| `mock-data.ts` | Simulated demo data |
| `tools.ts`, `define-tool.ts`, `draft-tool.ts` | The 6 Cline SDK tools (read-only + drafts) |
| `approval.ts` | `ApprovalStore`: pending → approved/rejected; coordinator-only; re-checks safety; calls `onApproved` once |
| `templates.ts` | Reviewed message wording |
| `briefing.ts` | Deterministic daily shortage briefing |
| `agent.ts` | `createCopilot`: Cline SDK `Agent`, system prompt, Gemini → Groq fallback |

## Tests

```bash
npm test               # shared + copilot (offline; the real Cline SDK loop runs with a scripted model)
npm run typecheck
```
