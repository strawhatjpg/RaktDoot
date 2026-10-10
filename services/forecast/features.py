"""Feature engineering for direct multi-horizon forecasting.

Each supervised row = (series, origin week t, horizon h). Features only use data
known at the origin (no leakage), plus calendar facts about the target week
(week of year, festival), which are known in advance.

Values are expressed relative to the series' 12-week mean ("base") so a single
model works for large and small series alike.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from config import BLOOD_GROUPS, DISTRICTS, FORECAST_COMPONENTS, MAX_HORIZON_WEEKS
from data.synthetic_generator import festival_in_week

SERIES_KEYS = ["district", "blood_group", "component"]

FEATURE_COLUMNS = [
    "horizon",
    "lag_1_r", "lag_2_r", "lag_4_r",
    "roll_mean_4_r", "lag_52_r", "seasonal_adj_r",
    "log_base", "week_of_year", "week_sin", "week_cos",
    "festival_flag", "supply_trend",
    "district_code", "group_code", "component_code",
]
CATEGORICAL_COLUMNS = ["district_code", "group_code", "component_code"]

MIN_HISTORY_WEEKS = 56  # need t-55 for last year's level around the origin


def load_history(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, keep_default_na=False)
    df["festival"] = df["festival"].astype(str)
    df["is_synthetic"] = df["is_synthetic"].astype(str).str.lower().isin(["true", "1"])
    return df


def _code(value: str, vocabulary: tuple[str, ...]) -> int:
    # Stable codes for known values; unknown districts share one extra code.
    return vocabulary.index(value) if value in vocabulary else len(vocabulary)


def build_supervised(
    history: pd.DataFrame,
    horizons: range = range(1, MAX_HORIZON_WEEKS + 1),
    include_future: bool = False,
) -> pd.DataFrame:
    """Build supervised rows. `target` is NaN for future (unlabelled) rows.

    include_future=True also returns rows from the LAST origin whose targets lie
    beyond the history (used for live forecasting).
    """
    frames: list[pd.DataFrame] = []
    for (district, group, component), series in history.groupby(SERIES_KEYS, sort=False):
        series = series.sort_values("week_start").reset_index(drop=True)
        d = series["demand_units"].astype(float)
        s = series["supply_units"].astype(float)
        weeks = pd.to_datetime(series["week_start"])
        n = len(series)
        if n < MIN_HISTORY_WEEKS:
            continue

        roll4 = d.rolling(4).mean()
        roll12 = d.rolling(12).mean()
        base = roll12 + 1.0
        last_year_level = d.shift(52).rolling(4).mean()  # mean of d[t-55..t-52]
        supply_roll4 = s.rolling(4).mean()
        supply_roll12 = s.rolling(12).mean()
        last_year_supply_level = s.shift(52).rolling(4).mean()

        for h in horizons:
            lag52 = d.shift(52 - h)  # same week last year, relative to the target
            # Mean supply of weeks target-53..target-51 (smoothed seasonal pattern).
            supply_lag52 = s.shift(52 - h - 1).rolling(3).mean()
            seasonal_index = ((supply_lag52 + 1.0) / (last_year_supply_level + 1.0)).clip(0.5, 1.5)
            frame = pd.DataFrame({
                "district": district,
                "blood_group": group,
                "component": component,
                "origin_week": weeks,
                "target_week": weeks + pd.Timedelta(weeks=h),
                "horizon": h,
                "target": d.shift(-h),
                "base": base,
                "lag_1": d,
                "lag_52": lag52,
                "lag_1_r": d / base,
                "lag_2_r": d.shift(1) / base,
                "lag_4_r": d.shift(3) / base,
                "roll_mean_4_r": roll4 / base,
                "lag_52_r": lag52 / base,
                "seasonal_adj_r": (lag52 * (roll4 + 1.0) / (last_year_level + 1.0)) / base,
                "log_base": np.log(base),
                "supply_trend": (supply_roll4 + 1.0) / (supply_roll12 + 1.0),
                "expected_supply": supply_roll4 * seasonal_index,
                "district_code": _code(str(district), DISTRICTS),
                "group_code": _code(str(group), BLOOD_GROUPS),
                "component_code": _code(str(component), FORECAST_COMPONENTS),
            })
            frame = frame.iloc[MIN_HISTORY_WEEKS - 1:]  # enough history for every lag
            if not include_future:
                frame = frame[frame["target"].notna()]
            else:
                is_last_origin = frame.index == n - 1
                frame = frame[frame["target"].notna() | is_last_origin]
            frames.append(frame)

    if not frames:
        raise ValueError(f"Need at least {MIN_HISTORY_WEEKS} weeks of history per series")
    out = pd.concat(frames, ignore_index=True)
    target_dates = out["target_week"].dt.date
    iso_week = out["target_week"].dt.isocalendar().week.astype(int)
    out["week_of_year"] = iso_week
    out["week_sin"] = np.sin(2 * np.pi * iso_week / 52.0)
    out["week_cos"] = np.cos(2 * np.pi * iso_week / 52.0)
    festivals = {d: festival_in_week(d) for d in target_dates.unique()}
    out["festival"] = target_dates.map(festivals)
    out["festival_flag"] = (out["festival"] != "").astype(int)
    return out


def week_start_of(value: date) -> date:
    return value - timedelta(days=value.weekday())
