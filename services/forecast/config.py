"""Shared constants for the forecast service.

Blood groups and components mirror `packages/shared/src/constants.ts`.
Everything this service produces is demonstrated on SYNTHETIC data.
"""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path
from typing import Final, Literal, get_args

BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
BloodComponent = Literal["WHOLE_BLOOD", "PACKED_RED_CELLS", "PLATELETS", "PLASMA", "UNKNOWN"]

BLOOD_GROUPS: Final[tuple[str, ...]] = get_args(BloodGroup)
BLOOD_COMPONENTS: Final[tuple[str, ...]] = get_args(BloodComponent)
# UNKNOWN is an intake placeholder, never a forecast target.
FORECAST_COMPONENTS: Final[tuple[str, ...]] = ("WHOLE_BLOOD", "PACKED_RED_CELLS", "PLATELETS", "PLASMA")

# Demo districts (pilot city still an open decision in docs/ROADMAP.md).
DISTRICTS: Final[tuple[str, ...]] = ("Pune", "Mumbai", "Nagpur")

HISTORY_START: Final[date] = date(2023, 10, 2)  # a Monday
HISTORY_WEEKS: Final[int] = 156  # 3 years of weekly data
MAX_HORIZON_WEEKS: Final[int] = 4
QUANTILES: Final[tuple[float, float, float]] = (0.1, 0.5, 0.9)

# ISO weeks used both by the synthetic generator and the explainable drivers.
DENGUE_PEAK_WEEK: Final[int] = 38  # mid/late September
DENGUE_WEEKS: Final[range] = range(32, 45)  # ~August to October
SUMMER_DIP_WEEKS: Final[range] = range(14, 25)  # ~April to mid-June

# Approximate festival dates (week containing the date is flagged).
FESTIVALS: Final[dict[str, tuple[date, ...]]] = {
    "Holi": (date(2023, 3, 8), date(2024, 3, 25), date(2025, 3, 14), date(2026, 3, 4), date(2027, 3, 22)),
    "Ganesh Chaturthi": (
        date(2023, 9, 19), date(2024, 9, 7), date(2025, 8, 27), date(2026, 9, 14), date(2027, 9, 4),
    ),
    "Dussehra": (date(2023, 10, 24), date(2024, 10, 12), date(2025, 10, 2), date(2026, 10, 20), date(2027, 10, 9)),
    "Diwali": (date(2023, 11, 12), date(2024, 11, 1), date(2025, 10, 20), date(2026, 11, 8), date(2027, 10, 29)),
}

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[2]
DEFAULT_DATA_PATH: Final[Path] = REPO_ROOT / "data" / "seed" / "historical_demand_synthetic.csv"


def data_path() -> Path:
    """CSV location; override with FORECAST_DATA_PATH."""
    return Path(os.environ.get("FORECAST_DATA_PATH", str(DEFAULT_DATA_PATH)))
