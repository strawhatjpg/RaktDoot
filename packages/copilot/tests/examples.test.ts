import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backtestResponseSchema, forecastResponseSchema } from "../src/schemas.ts";

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../services/forecast/examples/${name}`, import.meta.url), "utf8"));

test("example payloads for M4 match the contract schemas", () => {
  const forecast = forecastResponseSchema.parse(read("forecast_pune.json"));
  assert.equal(forecast.isSynthetic, true);
  assert.ok(forecast.points.length > 0);
  const backtest = backtestResponseSchema.parse(read("backtest_pune.json"));
  assert.ok(backtest.modelMae < backtest.baselineMae);
  assert.equal(backtest.weekly.length, backtest.weeksTested);
});
