from __future__ import annotations

import pandas as pd
import pytest

from data.synthetic_generator import generate_history
from features import FEATURE_COLUMNS, build_supervised


def test_no_missing_features_and_horizons(small_supervised: pd.DataFrame) -> None:
    assert not small_supervised[FEATURE_COLUMNS].isna().any().any()
    assert set(small_supervised["horizon"]) == {1, 2, 3, 4}


def test_target_is_future_demand_and_lags_are_past(small_history: pd.DataFrame, small_supervised: pd.DataFrame) -> None:
    series = small_history[
        (small_history["district"] == "Pune")
        & (small_history["blood_group"] == "O+")
        & (small_history["component"] == "PLATELETS")
    ].sort_values("week_start").reset_index(drop=True)
    demand = dict(zip(pd.to_datetime(series["week_start"]), series["demand_units"]))

    row = small_supervised[
        (small_supervised["district"] == "Pune")
        & (small_supervised["blood_group"] == "O+")
        & (small_supervised["component"] == "PLATELETS")
        & (small_supervised["horizon"] == 2)
        & small_supervised["target"].notna()
    ].iloc[10]
    origin = row["origin_week"]
    assert row["target_week"] == origin + pd.Timedelta(weeks=2)
    assert row["target"] == demand[row["target_week"]]
    assert row["lag_1"] == demand[origin]  # latest known week, never the target
    assert row["lag_52"] == demand[row["target_week"] - pd.Timedelta(weeks=52)]


def test_future_rows_only_from_last_origin(small_supervised: pd.DataFrame) -> None:
    future = small_supervised[small_supervised["target"].isna()]
    assert future["origin_week"].nunique() == 1
    assert future["origin_week"].iloc[0] == small_supervised["origin_week"].max()


def test_rejects_too_short_history() -> None:
    short = generate_history(districts=("Pune",), blood_groups=("O+",), weeks=30)
    with pytest.raises(ValueError):
        build_supervised(short)
