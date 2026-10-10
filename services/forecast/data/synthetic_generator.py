"""Generate SYNTHETIC weekly blood demand and supply history.

One row per week x district x blood group x component. Patterns built in:
- dengue-season platelet surge (peaks around ISO week 38)
- summer donation dip (supply falls April to mid-June)
- festival weeks (slightly more trauma demand, fewer donations)
- gentle upward trend and over-dispersed count noise

Usage (from services/forecast):
    python -m data.synthetic_generator            # writes data/seed/historical_demand_synthetic.csv
    python -m data.synthetic_generator --out x.csv
"""

from __future__ import annotations

import argparse
import math
from datetime import date, timedelta
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd

from config import (
    BLOOD_GROUPS,
    DEFAULT_DATA_PATH,
    DENGUE_PEAK_WEEK,
    DISTRICTS,
    FESTIVALS,
    FORECAST_COMPONENTS,
    HISTORY_START,
    HISTORY_WEEKS,
    SUMMER_DIP_WEEKS,
)

# Approximate Indian ABO/Rh distribution (sums to 1.0).
GROUP_SHARE: dict[str, float] = {
    "O+": 0.36, "B+": 0.32, "A+": 0.21, "AB+": 0.07,
    "O-": 0.015, "B-": 0.012, "A-": 0.009, "AB-": 0.004,
}
COMPONENT_SHARE: dict[str, float] = {
    "PACKED_RED_CELLS": 0.45, "PLATELETS": 0.25, "WHOLE_BLOOD": 0.20, "PLASMA": 0.10,
}
# Total weekly units demanded per district (all groups and components).
DISTRICT_WEEKLY_UNITS: dict[str, float] = {"Pune": 900.0, "Mumbai": 1600.0, "Nagpur": 550.0}
DEFAULT_DISTRICT_UNITS = 700.0

ANNUAL_TREND = 0.04
DEMAND_DISPERSION = 20.0  # gamma shape; lower = noisier
SUPPLY_DISPERSION = 30.0

OUTPUT_COLUMNS = [
    "week_start", "district", "blood_group", "component",
    "demand_units", "supply_units", "festival", "is_synthetic",
]


def festival_in_week(week_start: date) -> str:
    """Name of a festival falling in [week_start, week_start + 6 days], or ""."""
    week_end = week_start + timedelta(days=6)
    for name, dates in FESTIVALS.items():
        if any(week_start <= d <= week_end for d in dates):
            return name
    return ""


def dengue_intensity(iso_week: int) -> float:
    """0..1 bell curve centred on the dengue peak week."""
    return math.exp(-0.5 * ((iso_week - DENGUE_PEAK_WEEK) / 3.5) ** 2)


def _noisy_count(rng: np.random.Generator, mean: float, shape: float) -> int:
    """Gamma-Poisson (negative binomial) draw: over-dispersed, non-negative integer."""
    if mean <= 0:
        return 0
    lam = rng.gamma(shape=shape, scale=mean / shape)
    return int(rng.poisson(lam))


def generate_history(
    districts: Sequence[str] = DISTRICTS,
    blood_groups: Sequence[str] = BLOOD_GROUPS,
    components: Sequence[str] = FORECAST_COMPONENTS,
    start: date = HISTORY_START,
    weeks: int = HISTORY_WEEKS,
    seed: int = 42,
) -> pd.DataFrame:
    """Deterministic (for a given seed) synthetic history as a DataFrame."""
    if start.weekday() != 0:
        raise ValueError("start must be a Monday")
    rng = np.random.default_rng(seed)
    rows: list[dict[str, object]] = []

    for i in range(weeks):
        week_start = start + timedelta(weeks=i)
        iso_week = week_start.isocalendar().week
        years = i / 52.0
        trend = 1.0 + ANNUAL_TREND * years
        dengue = dengue_intensity(iso_week)
        festival = festival_in_week(week_start)
        summer = iso_week in SUMMER_DIP_WEEKS

        for district in districts:
            base = DISTRICT_WEEKLY_UNITS.get(district, DEFAULT_DISTRICT_UNITS)
            for group in blood_groups:
                for component in components:
                    level = base * GROUP_SHARE[group] * COMPONENT_SHARE[component] * trend

                    demand_mult = 1.0
                    supply_mult = 1.02
                    if component == "PLATELETS":
                        demand_mult *= 1.0 + 1.4 * dengue
                        supply_mult *= 1.0 + 0.9 * dengue  # centres respond, but lag behind
                    else:
                        demand_mult *= 1.0 + 0.08 * dengue
                    if summer:
                        demand_mult *= 1.03
                        supply_mult *= 0.80
                    if festival:
                        demand_mult *= 1.08
                        supply_mult *= 0.85

                    rows.append({
                        "week_start": week_start.isoformat(),
                        "district": district,
                        "blood_group": group,
                        "component": component,
                        "demand_units": _noisy_count(rng, level * demand_mult, DEMAND_DISPERSION),
                        "supply_units": _noisy_count(rng, level * supply_mult, SUPPLY_DISPERSION),
                        "festival": festival,
                        "is_synthetic": True,
                    })

    return pd.DataFrame(rows, columns=OUTPUT_COLUMNS)


def write_history(path: Path = DEFAULT_DATA_PATH, seed: int = 42) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    generate_history(seed=seed).to_csv(path, index=False)
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic weekly blood demand history.")
    parser.add_argument("--out", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    out = write_history(args.out, args.seed)
    print(f"Wrote synthetic history to {out}")


if __name__ == "__main__":
    main()
