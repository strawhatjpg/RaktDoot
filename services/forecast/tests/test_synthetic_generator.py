from __future__ import annotations

from datetime import date

import pandas as pd

from config import FORECAST_COMPONENTS, HISTORY_WEEKS
from data.synthetic_generator import OUTPUT_COLUMNS, festival_in_week, generate_history
from tests.conftest import TEST_DISTRICTS, TEST_GROUPS


def test_shape_columns_and_synthetic_flag(small_history: pd.DataFrame) -> None:
    expected_rows = HISTORY_WEEKS * len(TEST_DISTRICTS) * len(TEST_GROUPS) * len(FORECAST_COMPONENTS)
    assert len(small_history) == expected_rows
    assert list(small_history.columns) == OUTPUT_COLUMNS
    assert small_history["is_synthetic"].all()
    assert (small_history["demand_units"] >= 0).all()
    assert (small_history["supply_units"] >= 0).all()
    assert "UNKNOWN" not in set(small_history["component"])


def test_deterministic_for_same_seed() -> None:
    a = generate_history(districts=("Pune",), blood_groups=("O+",), weeks=60, seed=1)
    b = generate_history(districts=("Pune",), blood_groups=("O+",), weeks=60, seed=1)
    pd.testing.assert_frame_equal(a, b)


def test_dengue_platelet_surge(small_history: pd.DataFrame) -> None:
    platelets = small_history[small_history["component"] == "PLATELETS"].copy()
    platelets["iso_week"] = pd.to_datetime(platelets["week_start"]).dt.isocalendar().week
    peak = platelets[platelets["iso_week"].between(36, 40)]["demand_units"].mean()
    off_season = platelets[platelets["iso_week"].between(5, 12)]["demand_units"].mean()
    assert peak > 1.6 * off_season


def test_summer_supply_dip(small_history: pd.DataFrame) -> None:
    rbc = small_history[small_history["component"] == "PACKED_RED_CELLS"].copy()
    rbc["iso_week"] = pd.to_datetime(rbc["week_start"]).dt.isocalendar().week
    summer = rbc[rbc["iso_week"].between(15, 23)]["supply_units"].mean()
    winter = rbc[rbc["iso_week"].between(2, 10)]["supply_units"].mean()
    assert summer < 0.9 * winter


def test_festival_week_detection() -> None:
    assert festival_in_week(date(2025, 10, 20)) == "Diwali"
    assert festival_in_week(date(2025, 6, 2)) == ""
