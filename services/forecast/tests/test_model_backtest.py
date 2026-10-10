from __future__ import annotations

import pandas as pd

from engine import ForecastEngine
from model import QuantileForecaster, seasonal_naive


def test_quantiles_ordered_and_non_negative(small_supervised: pd.DataFrame) -> None:
    labelled = small_supervised[small_supervised["target"].notna()]
    model = QuantileForecaster.fit(labelled, max_iter=60)
    preds = model.predict(labelled.tail(200))
    assert (preds["p10"] >= 0).all()
    assert (preds["p10"] <= preds["p50"]).all()
    assert (preds["p50"] <= preds["p90"]).all()


def test_seasonal_naive_is_last_year(small_supervised: pd.DataFrame) -> None:
    row = small_supervised.iloc[[0]]
    assert seasonal_naive(row)[0] == row["lag_52"].iloc[0]


def test_model_beats_seasonal_naive_baseline(small_engine: ForecastEngine) -> None:
    summary = small_engine.backtest.summary()
    assert summary.weeks_tested >= 10
    assert summary.model_mae < summary.baseline_mae


def test_interval_coverage_is_reasonable(small_engine: ForecastEngine) -> None:
    # P10..P90 should hold roughly 80% of actuals.
    coverage = small_engine.backtest.summary().interval_coverage
    assert 0.6 <= coverage <= 0.95


def test_backtest_never_trains_on_future(small_engine: ForecastEngine) -> None:
    rows = small_engine.backtest.rows
    assert (rows["target_week"] > rows["origin_week"]).all()
