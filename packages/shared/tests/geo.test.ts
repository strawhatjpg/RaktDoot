import { test } from "node:test";
import assert from "node:assert/strict";
import { coarsenCoordinates, haversineKm, shouldPromptLocationUpdate } from "../src/geo.ts";

test("haversine distance between Pune and Mumbai is roughly 120 km", () => {
  const km = haversineKm({ lat: 18.5204, lng: 73.8567 }, { lat: 19.076, lng: 72.8777 });
  assert.ok(km > 110 && km < 130, `got ${km}`);
});

test("coordinates are coarsened to 2 decimals and invalid input rejected", () => {
  assert.deepEqual(coarsenCoordinates({ lat: 18.52049, lng: 73.85671 }), { lat: 18.52, lng: 73.86 });
  assert.throws(() => coarsenCoordinates({ lat: 120, lng: 0 }), RangeError);
});

test("location update prompt after 30 days or when missing", () => {
  const now = new Date("2026-03-01T00:00:00Z");
  assert.equal(shouldPromptLocationUpdate(null, now), true);
  assert.equal(shouldPromptLocationUpdate(new Date("2026-02-15T00:00:00Z"), now), false);
  assert.equal(shouldPromptLocationUpdate(new Date("2026-01-01T00:00:00Z"), now), true);
});