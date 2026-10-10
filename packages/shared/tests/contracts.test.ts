import { test } from "node:test";
import assert from "node:assert/strict";
import * as shared from "../src/index.ts";
import type { ExtractedRequest, ForecastResponse } from "../src/index.ts";

test("shared index exports contracts and languages", () => {
  assert.deepEqual([...shared.SUPPORTED_LANGUAGES], ["en", "hi", "hi-Latn", "mr"]);
});

test("contract shapes compile with sample payloads", () => {
  const extracted: ExtractedRequest = {
    language: "hi-Latn",
    hospitalName: { value: "City Hospital", confidence: 0.9 },
    bloodGroup: { value: "B+", confidence: 0.95 },
    component: { value: null, confidence: 0 },
    units: { value: 2, confidence: 0.9 },
    neededBy: { value: null, confidence: 0 },
    missingFields: ["component", "neededBy"],
    originalText: "Papa City Hospital mein admit hain, B positive ke 2 unit chahiye",
  };
  const forecast: ForecastResponse = {
    district: "Pune",
    generatedAt: "2026-10-10T00:00:00Z",
    isSynthetic: true,
    backtest: { modelMae: 3.1, baselineMae: 4.4, weeksTested: 26 },
    points: [],
  };
  assert.equal(extracted.missingFields.length, 2);
  assert.ok(forecast.backtest.modelMae < forecast.backtest.baselineMae);
});