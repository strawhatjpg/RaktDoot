from __future__ import annotations

import pytest

from risk import shortage_probability


def test_supply_far_above_demand_is_low_risk() -> None:
    assert shortage_probability(40, 50, 60, supply=120) < 0.01


def test_supply_far_below_demand_is_high_risk() -> None:
    assert shortage_probability(40, 50, 60, supply=10) > 0.99


def test_supply_at_median_is_about_half() -> None:
    assert 0.4 <= shortage_probability(40, 50, 60, supply=49.5) <= 0.6


def test_risk_falls_as_supply_rises() -> None:
    risks = [shortage_probability(30, 50, 80, supply=s) for s in (20, 40, 60, 80)]
    assert risks == sorted(risks, reverse=True)


def test_zero_width_range_still_valid() -> None:
    risk = shortage_probability(0, 0, 0, supply=0)
    assert 0.0 <= risk <= 1.0


def test_rejects_crossing_quantiles() -> None:
    with pytest.raises(ValueError):
        shortage_probability(60, 50, 40, supply=50)
