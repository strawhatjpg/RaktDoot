"""Forecast engine: loads history, backtests, trains, and serves forecasts."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Sequence

import pandas as pd

from backtest import BacktestResult, BacktestSummary, rolling_origin_backtest
from config import DENGUE_WEEKS, SUMMER_DIP_WEEKS, data_path
from data.synthetic_generator import write_history
from features import build_supervised, load_history
from model import QuantileForecaster
from risk import shortage_probability

MAX_DRIVERS = 3


class UnknownDistrictError(ValueError):
    pass


@dataclass(frozen=True)
class EngineSettings:
    max_iter: int = 200
    backtest_folds: int = 6

    @classmethod
    def from_env(cls) -> "EngineSettings":
        return cls(
            max_iter=int(os.environ.get("FORECAST_MAX_ITER", "200")),
            backtest_folds=int(os.environ.get("FORECAST_BACKTEST_FOLDS", "6")),
        )


def explain_drivers(row: pd.Series, p50: float, expected_supply: float) -> list[str]:
    """Deterministic, human-readable reasons for a forecast point (no LLM)."""
    drivers: list[str] = []
    week = int(row["week_of_year"])
    if row["component"] == "PLATELETS" and week in DENGUE_WEEKS:
        drivers.append(f"Dengue season (week {week}): platelet demand usually rises")
    if row["festival"]:
        drivers.append(f"{row['festival']} week: donations usually dip")
    if week in SUMMER_DIP_WEEKS:
        drivers.append("Summer donation dip: fewer donors at centres")
    supply_trend = float(row["supply_trend"])
    if supply_trend < 0.95:
        drivers.append(f"Recent supply {round((1 - supply_trend) * 100)}% below its 12-week average")
    last_week = float(row["lag_1"])
    if last_week > 0:
        change = (p50 - last_week) / last_week
        if abs(change) >= 0.10:
            direction = "up" if change > 0 else "down"
            drivers.append(f"Demand expected {direction} {round(abs(change) * 100)}% vs last week")
    if p50 > expected_supply:
        drivers.append(f"Median demand {round(p50)} vs expected supply {round(expected_supply)} units")
    if not drivers:
        drivers.append(f"In line with same week last year ({round(float(row['lag_52']))} units)")
    return drivers[:MAX_DRIVERS]



class ForecastEngine:
    def __init__(self, history: pd.DataFrame, settings: EngineSettings = EngineSettings()) -> None:
        self.history = history
        self.settings = settings
        self.is_synthetic = bool(history["is_synthetic"].all())
        self.districts = tuple(sorted(history["district"].unique()))
        supervised = build_supervised(history, include_future=True)
        labelled = supervised[supervised["target"].notna()]
        self.backtest: BacktestResult = rolling_origin_backtest(
            labelled, folds=settings.backtest_folds, max_iter=settings.max_iter
        )
        self.model = QuantileForecaster.fit(labelled, max_iter=settings.max_iter)
        last_origin = supervised["origin_week"].max()
        future = supervised[(supervised["origin_week"] == last_origin) & supervised["target"].isna()].copy()
        future[["p10", "p50", "p90"]] = self.model.predict(future)[["p10", "p50", "p90"]].to_numpy()
        self.future = future
        self.last_history_week = last_origin.date()

    @classmethod
    def from_csv(cls, path: Path, settings: EngineSettings = EngineSettings()) -> "ForecastEngine":
        if not path.exists():
            write_history(path)
        return cls(load_history(path), settings)

    def backtest_summary(self, district: str) -> BacktestSummary:
        self._check_district(district)
        return self.backtest.summary(district)

    def forecast(
        self,
        district: str,
        horizon_weeks: int,
        blood_groups: Sequence[str] | None = None,
        components: Sequence[str] | None = None,
    ) -> dict[str, object]:
        """Build a `ForecastResponse` (packages/shared/src/contracts.ts) as a dict."""
        self._check_district(district)
        rows = self.future[(self.future["district"] == district) & (self.future["horizon"] <= horizon_weeks)]
        if blood_groups:
            rows = rows[rows["blood_group"].isin(blood_groups)]
        if components:
            rows = rows[rows["component"].isin(components)]
        rows = rows.sort_values(["target_week", "blood_group", "component"])

        points: list[dict[str, object]] = []
        for _, row in rows.iterrows():
            p10, p50, p90 = float(row["p10"]), float(row["p50"]), float(row["p90"])
            supply = max(float(row["expected_supply"]), 0.0)
            points.append({
                "weekStart": row["target_week"].date().isoformat(),
                "bloodGroup": row["blood_group"],
                "component": row["component"],
                "p10": round(p10, 1),
                "p50": round(p50, 1),
                "p90": round(p90, 1),
                "expectedSupply": round(supply, 1),
                "shortageRisk": round(shortage_probability(p10, p50, p90, supply), 3),
                "drivers": explain_drivers(row, p50, supply),
            })

        summary = self.backtest.summary(district)
        return {
            "district": district,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "isSynthetic": self.is_synthetic,
            "backtest": {
                "modelMae": round(summary.model_mae, 2),
                "baselineMae": round(summary.baseline_mae, 2),
                "weeksTested": summary.weeks_tested,
            },
            "points": points,
        }

    def _check_district(self, district: str) -> None:
        if district not in self.districts:
            raise UnknownDistrictError(f"Unknown district {district!r}. Known: {', '.join(self.districts)}")


@lru_cache(maxsize=1)
def get_engine() -> ForecastEngine:
    return ForecastEngine.from_csv(data_path(), EngineSettings.from_env())
