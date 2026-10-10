"""Pydantic schemas mirroring `packages/shared/src/contracts.ts` (Member 3 section).

Field names are camelCase on purpose so JSON matches the TypeScript contract exactly.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from config import MAX_HORIZON_WEEKS, BloodComponent, BloodGroup


class ForecastQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district: str = Field(min_length=1, max_length=80)
    horizonWeeks: int = Field(ge=1, le=MAX_HORIZON_WEEKS)
    bloodGroups: list[BloodGroup] | None = None
    components: list[BloodComponent] | None = None

    @field_validator("district")
    @classmethod
    def strip_district(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("district must not be blank")
        return value

    @field_validator("components")
    @classmethod
    def no_unknown_component(cls, value: list[str] | None) -> list[str] | None:
        if value and "UNKNOWN" in value:
            raise ValueError("UNKNOWN is an intake placeholder and cannot be forecast")
        return value


class ForecastPoint(BaseModel):
    weekStart: str
    bloodGroup: BloodGroup
    component: BloodComponent
    p10: float = Field(ge=0)
    p50: float = Field(ge=0)
    p90: float = Field(ge=0)
    expectedSupply: float = Field(ge=0)
    shortageRisk: float = Field(ge=0, le=1)
    drivers: list[str]


class BacktestInfo(BaseModel):
    modelMae: float
    baselineMae: float
    weeksTested: int


class ForecastResponse(BaseModel):
    district: str
    generatedAt: str
    isSynthetic: bool
    backtest: BacktestInfo
    points: list[ForecastPoint]


class WeeklyError(BaseModel):
    weekStart: str
    modelMae: float
    baselineMae: float


class BacktestResponse(BaseModel):
    """Extra endpoint for the dashboard's "model vs baseline" chart (not in contracts.ts)."""

    district: str
    isSynthetic: bool
    modelMae: float
    baselineMae: float
    weeksTested: int
    intervalCoverage: float = Field(ge=0, le=1)
    weekly: list[WeeklyError]
