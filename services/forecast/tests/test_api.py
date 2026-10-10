from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

import engine as engine_module
import main
from engine import ForecastEngine
from schemas import ForecastResponse


@pytest.fixture()
def client(small_engine: ForecastEngine, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(main, "get_engine", lambda: small_engine)
    monkeypatch.setattr(engine_module, "get_engine", lambda: small_engine)
    with TestClient(main.app) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["isSynthetic"] is True
    assert "Pune" in body["districts"]


def test_forecast_matches_contract(client: TestClient) -> None:
    res = client.post("/forecast", json={"district": "Pune", "horizonWeeks": 2})
    assert res.status_code == 200
    body = ForecastResponse.model_validate(res.json())
    assert body.isSynthetic is True
    assert body.backtest.weeksTested > 0
    assert len({p.weekStart for p in body.points}) == 2
    for p in body.points:
        assert p.p10 <= p.p50 <= p.p90
        assert 0 <= p.shortageRisk <= 1
        assert p.drivers
        assert p.component != "UNKNOWN"


def test_forecast_filters(client: TestClient) -> None:
    res = client.post(
        "/forecast",
        json={"district": "Pune", "horizonWeeks": 4, "bloodGroups": ["O+"], "components": ["PLATELETS"]},
    )
    points = res.json()["points"]
    assert len(points) == 4
    assert {(p["bloodGroup"], p["component"]) for p in points} == {("O+", "PLATELETS")}


@pytest.mark.parametrize(
    "payload",
    [
        {"district": "Pune", "horizonWeeks": 0},
        {"district": "Pune", "horizonWeeks": 5},
        {"district": "Pune", "horizonWeeks": 1, "bloodGroups": ["B+ve"]},
        {"district": "Pune", "horizonWeeks": 1, "components": ["UNKNOWN"]},
        {"district": " ", "horizonWeeks": 1},
        {"district": "Pune", "horizonWeeks": 1, "extra": True},
    ],
)
def test_forecast_rejects_invalid_input(client: TestClient, payload: dict[str, object]) -> None:
    assert client.post("/forecast", json=payload).status_code == 422


def test_unknown_district_is_404(client: TestClient) -> None:
    assert client.post("/forecast", json={"district": "Atlantis", "horizonWeeks": 1}).status_code == 404
    assert client.get("/backtest", params={"district": "Atlantis"}).status_code == 404


def test_backtest_endpoint(client: TestClient) -> None:
    body = client.get("/backtest", params={"district": "Nagpur"}).json()
    assert body["isSynthetic"] is True
    assert body["modelMae"] < body["baselineMae"]
    assert len(body["weekly"]) == body["weeksTested"]
