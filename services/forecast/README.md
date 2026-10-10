# services/forecast

Python FastAPI service for area demand forecasting (AI pillar 2).

- Synthetic 3-year weekly demand generator (district × blood group × component)
- Seasonal-naive baseline vs gradient boosting with quantile loss (P10 / P50 / P90)
- Rolling-origin backtest; error vs baseline exposed via the API

Pipeline details: [`docs/PIPELINES.md`](../../docs/PIPELINES.md) § E. Built in the coding phase.