"""Rolling-origin backtest: model (P50) vs seasonal-naive baseline."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from model import QuantileForecaster, seasonal_naive


@dataclass(frozen=True)
class BacktestSummary:
    model_mae: float
    baseline_mae: float
    weeks_tested: int
    interval_coverage: float  # share of actuals inside P10..P90 (target ~0.8)


@dataclass(frozen=True)
class BacktestResult:
    rows: pd.DataFrame  # one row per tested (series, origin, horizon)

    def summary(self, district: str | None = None) -> BacktestSummary:
        rows = self.rows if district is None else self.rows[self.rows["district"] == district]
        if rows.empty:
            raise ValueError(f"No backtest rows for district {district!r}")
        inside = (rows["target"] >= rows["p10"]) & (rows["target"] <= rows["p90"])
        return BacktestSummary(
            model_mae=float(rows["model_abs_error"].mean()),
            baseline_mae=float(rows["baseline_abs_error"].mean()),
            weeks_tested=int(rows["target_week"].nunique()),
            interval_coverage=float(inside.mean()),
        )

    def weekly_errors(self, district: str | None = None) -> list[dict[str, object]]:
        """MAE per tested target week (chart data for model vs baseline)."""
        rows = self.rows if district is None else self.rows[self.rows["district"] == district]
        grouped = rows.groupby("target_week").agg(
            model_mae=("model_abs_error", "mean"),
            baseline_mae=("baseline_abs_error", "mean"),
        )
        return [
            {
                "weekStart": week.date().isoformat(),
                "modelMae": round(float(r.model_mae), 2),
                "baselineMae": round(float(r.baseline_mae), 2),
            }
            for week, r in grouped.iterrows()
        ]


def rolling_origin_backtest(
    supervised: pd.DataFrame,
    folds: int = 6,
    step_weeks: int = 4,
    max_iter: int = 200,
) -> BacktestResult:
    """Retrain at each origin using only rows whose target is known by then.

    With step_weeks == max horizon (4), the tested target weeks do not overlap.
    """
    labelled = supervised[supervised["target"].notna()]
    max_h = int(labelled["horizon"].max())
    # Latest origin for which every horizon has an observed target.
    complete = labelled.groupby("origin_week")["horizon"].nunique()
    last_origin = complete[complete == max_h].index.max()
    origins = [last_origin - pd.Timedelta(weeks=step_weeks * k) for k in reversed(range(folds))]

    results: list[pd.DataFrame] = []
    for origin in origins:
        train = labelled[labelled["target_week"] <= origin]
        test = labelled[labelled["origin_week"] == origin]
        if train.empty or test.empty:
            continue
        model = QuantileForecaster.fit(train, max_iter=max_iter)
        preds = model.predict(test)
        fold = test[["district", "blood_group", "component", "origin_week", "target_week", "horizon", "target"]].copy()
        fold[["p10", "p50", "p90"]] = preds[["p10", "p50", "p90"]].to_numpy()
        fold["baseline"] = seasonal_naive(test)
        fold["model_abs_error"] = np.abs(fold["p50"] - fold["target"])
        fold["baseline_abs_error"] = np.abs(fold["baseline"] - fold["target"])
        results.append(fold)

    if not results:
        raise ValueError("Not enough history for the requested backtest")
    return BacktestResult(rows=pd.concat(results, ignore_index=True))
