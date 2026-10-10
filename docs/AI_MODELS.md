# AI models (Member 3: prediction pillar + Cline inside the product)

> Everything below is **demonstrated on synthetic data**. Numbers show the pipeline works on patterns we
> designed; they are not evidence of real-world accuracy. The UI must show the "synthetic data" label.

## 1. Demand forecasting (`services/forecast`)

**Question answered:** how many units of each blood group × component will a district need in each of the
next 1–4 weeks, and how likely is demand to exceed expected supply?

| Item | Choice | Why |
|---|---|---|
| Data | 3 years weekly, 3 districts × 8 groups × 4 components (14,976 rows) | No public weekly demand data for Indian districts |
| Built-in patterns | Dengue platelet surge (peak ISO week 38), summer donation dip (Apr–Jun), festival weeks (Holi, Ganesh Chaturthi, Dussehra, Diwali), +4 %/yr trend, negative-binomial noise | Patterns reported for Indian blood banks |
| Baseline | Seasonal naive: same week last year | Standard and hard to beat for seasonal data |
| Model | scikit-learn `HistGradientBoostingRegressor`, quantile loss, one model each for P10 / P50 / P90 | Fast on a laptop, gives ranges, free |
| Features | Lags 1/2/4, 4-week mean, same week last year, seasonally adjusted lag-52, week of year (+sin/cos), festival flag, supply trend, district/group/component | Only data known at forecast time (no leakage) |
| Scaling | Targets divided by the series' 12-week mean | One model fits large and small series |
| Shortage risk | P(demand > expected supply) from a split-normal fitted to P10/P50/P90 | Honest with skewed ranges |
| Expected supply | Recent 4-week supply × last year's seasonal supply index | Simple and explainable |
| Drivers | Fixed rules (dengue season, festival, summer dip, supply trend, change vs last week) | Explainable, no LLM |

### Backtest (rolling origin, 6 folds × 4 weeks, retrained at each origin)

| District | Model MAE (P50) | Seasonal-naive MAE | Improvement | P10–P90 coverage (target ≈ 80 %) |
|---|---|---|---|---|
| Pune | 8.48 | 11.05 | 23 % | 78 % |
| Mumbai | 13.47 | 17.66 | 24 % | 81 % |
| Nagpur | 5.07 | 7.04 | 28 % | 82 % |

MAE = mean absolute error in units per series-week, over 24 tested weeks. Tests in
`services/forecast/tests/test_model_backtest.py` fail if the model stops beating the baseline.

### Limits

- Synthetic data only; approximate festival dates; three demo districts.
- No live requests or stock snapshots yet (planned once M2's DB exists).
- Small series (rare groups, 1–5 units/week) have noisy risk; the briefing hides series with median < 10 units.
- Forecasts support planning only. They never decide urgency, stock existence or who gets blood.

## 2. Coordinator Copilot (`packages/copilot`, Cline SDK)

**Cline inside the product:** `Agent` and `createTool` from `@cline/sdk` (0.0.92), Gemini free tier first,
Groq free plan as fallback on 429 / quota (one backoff retry, then next provider).

| Tool | Does | Can change data? |
|---|---|---|
| `get_open_requests` | Lists open requests | No |
| `search_blood_centres` | Licensed centres + stock status (simulated flag) | No |
| `rank_donors` | Explained ranking, first names only; refuses unverified requests | No |
| `get_forecast` | Calls the forecast service; highest-risk points first; synthetic label | No |
| `summarize_case` | Request + timeline + centres + "outreach allowed?" | No |
| `draft_outreach_message` | Creates a **PENDING** draft from reviewed templates | Draft only |

**Guardrails**
- No tool can send, close or edit. Sending exists only behind `ApprovalStore.approve()`, which requires a
  COORDINATOR/ADMIN, re-checks verification at approval time, and dispatches exactly once.
- Message wording comes from reviewed templates (`templates.ts`): "may be eligible", licensed blood centre only,
  screening decides, STOP/PAUSE opt-out. The LLM picks the draft type, not the safety wording.
- Tool inputs from the LLM are zod-validated; errors go back to the model, never crash the run.
- Allow-list: tools outside the six are refused via `toolPolicies` + `requestToolApproval`.
- System prompt forbids clinical decisions, invented facts and phone numbers; answers in the user's language.
- Only demo/synthetic data is sent to free-tier providers.

**Daily shortage briefing:** `buildShortageBriefing()` computes the facts with no LLM (high-risk points,
pending verifications, active outreach). The Copilot can phrase it in Hindi/Marathi; the UI can show the
plain version if the LLM is rate-limited.

**Tests:** 31 `node:test` tests (+4 DB integration tests in `apps/web/tests/copilot.test.ts`) run the real Cline SDK agent loop with a scripted offline model
(tool calls → draft → final answer), plus provider fallback, approval rules and template wording.
