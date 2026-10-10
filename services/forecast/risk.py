"""Shortage risk: probability that demand exceeds expected supply.

The forecast distribution is approximated from P10/P50/P90 with a split normal
(different spread below and above the median), so skewed ranges stay honest.
"""

from __future__ import annotations

import math

Z_90 = 1.2815515655446004  # standard normal quantile at 0.9
MIN_SIGMA = 0.5  # units; avoids zero-width ranges for tiny series


def _normal_cdf(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def shortage_probability(p10: float, p50: float, p90: float, supply: float) -> float:
    """P(demand > supply) in 0..1.

    Demand counts are whole units, so "exceeds supply" means demand >= supply + 1;
    a +0.5 continuity correction is applied.
    """
    if not (p10 <= p50 <= p90):
        raise ValueError("quantiles must satisfy p10 <= p50 <= p90")
    threshold = max(supply, 0.0) + 0.5
    if threshold >= p50:
        sigma = max((p90 - p50) / Z_90, MIN_SIGMA)
    else:
        sigma = max((p50 - p10) / Z_90, MIN_SIGMA)
    risk = 1.0 - _normal_cdf((threshold - p50) / sigma)
    return min(max(risk, 0.0), 1.0)
