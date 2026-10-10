"""Shared fixtures: a small synthetic dataset so tests stay fast."""

from __future__ import annotations

import pandas as pd
import pytest

from data.synthetic_generator import generate_history
from engine import EngineSettings, ForecastEngine
from features import build_supervised

TEST_DISTRICTS = ("Pune", "Nagpur")
TEST_GROUPS = ("O+", "B+", "A-")


@pytest.fixture(scope="session")
def small_history() -> pd.DataFrame:
    return generate_history(districts=TEST_DISTRICTS, blood_groups=TEST_GROUPS, seed=7)


@pytest.fixture(scope="session")
def small_supervised(small_history: pd.DataFrame) -> pd.DataFrame:
    return build_supervised(small_history, include_future=True)


@pytest.fixture(scope="session")
def small_engine(small_history: pd.DataFrame) -> ForecastEngine:
    return ForecastEngine(small_history, EngineSettings(max_iter=120, backtest_folds=4))
