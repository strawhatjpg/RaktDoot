"""Models: seasonal-naive baseline and gradient boosting with quantile loss."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from config import QUANTILES
from features import CATEGORICAL_COLUMNS, FEATURE_COLUMNS


def seasonal_naive(frame: pd.DataFrame) -> np.ndarray:
    """Baseline: demand in the same week last year."""
    return frame["lag_52"].to_numpy(dtype=float)


@dataclass
class QuantileForecaster:
    """One HistGradientBoostingRegressor per quantile, trained on base-relative targets."""

    models: dict[float, HistGradientBoostingRegressor]

    @classmethod
    def fit(
        cls,
        train: pd.DataFrame,
        quantiles: tuple[float, ...] = QUANTILES,
        max_iter: int = 200,
        random_state: int = 0,
    ) -> "QuantileForecaster":
        labelled = train[train["target"].notna()]
        if labelled.empty:
            raise ValueError("No labelled rows to train on")
        x = labelled[FEATURE_COLUMNS]
        y = (labelled["target"] / labelled["base"]).to_numpy(dtype=float)
        categorical = [FEATURE_COLUMNS.index(c) for c in CATEGORICAL_COLUMNS]
        models: dict[float, HistGradientBoostingRegressor] = {}
        for q in quantiles:
            model = HistGradientBoostingRegressor(
                loss="quantile",
                quantile=q,
                max_iter=max_iter,
                learning_rate=0.05,
                max_leaf_nodes=31,
                min_samples_leaf=20,
                categorical_features=categorical,
                random_state=random_state,
            )
            model.fit(x, y)
            models[q] = model
        return cls(models=models)

    def predict(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Return p10/p50/p90 in units: non-negative and non-crossing."""
        x = frame[FEATURE_COLUMNS]
        base = frame["base"].to_numpy(dtype=float)
        preds = np.column_stack([self.models[q].predict(x) * base for q in sorted(self.models)])
        preds = np.sort(np.clip(preds, 0.0, None), axis=1)  # fix any quantile crossing
        names = [f"p{round(q * 100)}" for q in sorted(self.models)]
        return pd.DataFrame(preds, columns=names, index=frame.index)
