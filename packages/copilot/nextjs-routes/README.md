# Next.js integration (copy once `apps/web` exists)

These files are ready-made App Router routes for M2's Next.js app. They are kept here because
`apps/web` is not scaffolded yet. **M3 copies them in at Sync 2**; nothing else needs to change.

| Copy from | To |
|---|---|
| `server/forecast/client.ts` | `apps/web/src/server/forecast/client.ts` |
| `server/copilot/index.ts` | `apps/web/src/server/copilot/index.ts` |
| `api/forecast/route.ts` | `apps/web/src/app/api/forecast/route.ts` |
| `api/forecast/backtest/route.ts` | `apps/web/src/app/api/forecast/backtest/route.ts` |
| `api/copilot/route.ts` | `apps/web/src/app/api/copilot/route.ts` |
| `api/copilot/drafts/route.ts` | `apps/web/src/app/api/copilot/drafts/route.ts` |
| `api/copilot/drafts/[id]/route.ts` | `apps/web/src/app/api/copilot/drafts/[id]/route.ts` |
| `api/copilot/briefing/route.ts` | `apps/web/src/app/api/copilot/briefing/route.ts` |

Then in `apps/web/package.json` (M2) add `"@raktdoot/copilot": "0.1.0"` and in `next.config` add
`transpilePackages: ["@raktdoot/shared", "@raktdoot/copilot"]`.

## Two things M2 must plug in

1. **Staff session**: `server/copilot/index.ts` → `getStaffRole()` currently reads an `x-demo-role`
   header (demo only). Replace with the real session lookup from `src/server/auth/session.ts`.
2. **Real data + dispatch**: replace `createMockDataSource()` with a DB-backed `CopilotDataSource`
   and `onApproved` with the outreach/notification call. Rules (verified-only outreach,
   coordinator-only approval, re-check at approval) are already enforced inside `ApprovalStore`.

## API for M4 (UI)

| Method | Path | Body / query | Response |
|---|---|---|---|
| POST | `/api/forecast` | `ForecastQuery` | `ForecastResponse` (contracts.ts) |
| GET | `/api/forecast/backtest?district=Pune` | | model vs baseline per week (chart) |
| POST | `/api/copilot` | `{ question }` | `{ text, provider, toolsUsed, draftIds, drafts }` |
| GET | `/api/copilot/briefing?district=Pune` | | `{ briefing, text }` (no LLM needed) |
| GET | `/api/copilot/drafts?status=PENDING_APPROVAL` | | `{ drafts }` |
| POST | `/api/copilot/drafts/:id` | `{ action: "approve" \| "reject" \| "edit", note?, message? }` | `{ draft }` or `{ error }` |

Errors: `400` invalid input, `403` not a coordinator, `404` unknown, `409` rule blocked, `502/503` upstream down.
