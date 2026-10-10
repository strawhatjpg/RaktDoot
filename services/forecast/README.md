# services/forecast

Python FastAPI service for area demand forecasting (AI pillar 2).

- Synthetic 3-year weekly demand generator (district × blood group × component)
- Seasonal-naive baseline vs gradient boosting with quantile loss (P10 / P50 / P90)
- Rolling-origin backtest; error vs baseline exposed via the API

Pipeline details: [`docs/PIPELINES.md`](../../docs/PIPELINES.md) § E.

> **Demonstrated on synthetic data.** Every response carries `isSynthetic: true`; the UI must show this label.

## Run

```bash
cd services/forecast
python3.11 -m venv .venv            # 3.11/3.12 recommended for scikit-learn wheels
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m data.synthetic_generator   # writes data/seed/historical_demand_synthetic.csv
.venv/bin/uvicorn main:app --port 8000          # trains at startup (~20 s)
.venv/bin/python -m pytest                      # 31 tests
```

If the CSV is missing, the service generates it on startup.

## API

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/health` | — | status, districts, last history week, `isSynthetic` |
| POST | `/forecast` | `ForecastQuery` `{ district, horizonWeeks (1–4), bloodGroups?, components? }` | `ForecastResponse` (see `packages/shared/src/contracts.ts`) |
| GET | `/backtest?district=Pune` | — | model vs baseline MAE, P10–P90 coverage, per-week errors (chart data) |

Input is validated with Pydantic: bad blood groups (`"B+ve"`), `UNKNOWN` component, horizon outside 1–4 or extra fields → `422`; unknown district → `404`. Interactive docs at `/docs`.

```bash
curl -X POST localhost:8000/forecast -H 'content-type: application/json' \
  -d '{"district":"Pune","horizonWeeks":4,"bloodGroups":["O+"],"components":["PLATELETS"]}'
```

## How it works

| File | Role |
|---|---|
| `data/synthetic_generator.py` | 3 years weekly, 3 districts × 8 groups × 4 components; dengue platelet surge (peak ISO week 38), summer donation dip, festival weeks, 4%/yr trend, negative-binomial noise. Seeded, reproducible |
| `features.py` | Direct multi-horizon rows (h = 1–4): lags 1/2/4, rolling 4-week mean, same week last year (lag 52), seasonally adjusted lag 52, week of year (+ sin/cos), festival flag, supply trend. Values scaled by the 12-week mean so one model fits all series. No future leakage |
| `model.py` | Seasonal-naive baseline (same week last year) vs `HistGradientBoostingRegressor` with quantile loss → P10 / P50 / P90 (sorted to prevent crossing) |
| `backtest.py` | Rolling origin: 6 folds × 4 weeks, model retrained at each origin on data known by then |
| `risk.py` | P(demand > expected supply) from a split-normal fitted to P10/P50/P90 |
| `engine.py` | Trains once, caches forecasts, adds deterministic, explainable `drivers` (no LLM) |

Expected supply = recent 4-week supply × last year's seasonal supply index for the target week.

## Backtest results (synthetic data, seed 42)

| District | Model MAE (P50) | Seasonal-naive MAE | Improvement | P10–P90 coverage |
|---|---|---|---|---|
| Pune | 8.48 | 11.05 | 23% | 78% |
| Mumbai | 13.47 | 17.66 | 24% | 81% |
| Nagpur | 5.07 | 7.04 | 28% | 82% |

24 weeks tested per district; MAE in units per series-week. These numbers only show the pipeline works on data whose patterns we designed. They say nothing about real-world accuracy.

## Limits

- Synthetic data only; festival dates approximate; three demo districts.
- Forecasts support coordinator planning only: they never decide urgency, stock existence or who gets blood.
- Live request history and stock snapshots are not yet ingested (planned once M2's DB exists).