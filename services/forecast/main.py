"""RaktDoot forecast service (FastAPI). Demonstrated on SYNTHETIC data.

Run from services/forecast:
    uvicorn main:app --port 8000
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query

from engine import UnknownDistrictError, get_engine
from schemas import BacktestResponse, ForecastQuery, ForecastResponse


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_engine()  # train once at startup so the first request is fast
    yield


app = FastAPI(
    title="RaktDoot forecast service",
    description="Weekly blood demand ranges (P10/P50/P90) and shortage risk. Synthetic data.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, object]:
    engine = get_engine()
    return {
        "status": "ok",
        "isSynthetic": engine.is_synthetic,
        "districts": list(engine.districts),
        "lastHistoryWeek": engine.last_history_week.isoformat(),
    }


@app.post("/forecast", response_model=ForecastResponse)
def forecast(query: ForecastQuery) -> dict[str, object]:
    try:
        return get_engine().forecast(
            district=query.district,
            horizon_weeks=query.horizonWeeks,
            blood_groups=query.bloodGroups,
            components=query.components,
        )
    except UnknownDistrictError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/backtest", response_model=BacktestResponse)
def backtest(district: str = Query(min_length=1, max_length=80)) -> dict[str, object]:
    engine = get_engine()
    try:
        summary = engine.backtest_summary(district)
    except UnknownDistrictError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "district": district,
        "isSynthetic": engine.is_synthetic,
        "modelMae": round(summary.model_mae, 2),
        "baselineMae": round(summary.baseline_mae, 2),
        "weeksTested": summary.weeks_tested,
        "intervalCoverage": round(summary.interval_coverage, 3),
        "weekly": engine.backtest.weekly_errors(district),
    }
