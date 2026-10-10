import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveAvailability } from "../src/donor.ts";
import { hasActiveConsent, type ConsentRecord } from "../src/consent.ts";
import { validateAvailabilityUpdate, validateConsentUpdate, validateDonorRegistration, validateLocationUpdate } from "../src/validation.ts";

const now = new Date("2026-01-01T00:00:00.000Z");

test("expired or open-ended UNAVAILABLE becomes PAUSED, never AVAILABLE", () => {
  assert.equal(effectiveAvailability("UNAVAILABLE", new Date("2026-02-01T00:00:00.000Z"), now), "UNAVAILABLE");
  assert.equal(effectiveAvailability("UNAVAILABLE", new Date("2025-12-01T00:00:00.000Z"), now), "PAUSED");
  assert.equal(effectiveAvailability("UNAVAILABLE", null, now), "PAUSED");
  assert.equal(effectiveAvailability("AVAILABLE", null, now), "AVAILABLE");
});

test("same-timestamp consent records are ordered by sequence", () => {
  const t = new Date("2026-01-01T00:00:00Z");
  const records: ConsentRecord[] = [
    { type: "URGENT_ALERTS", channel: "WHATSAPP", granted: false, recordedAt: t, sequence: 2 },
    { type: "URGENT_ALERTS", channel: "WHATSAPP", granted: true, recordedAt: t, sequence: 1 },
  ];
  assert.equal(hasActiveConsent(records, "URGENT_ALERTS", "WHATSAPP"), false);
});

test("consent updates enforce channel rules and block global contact sharing", () => {
  const ok = validateConsentUpdate({ termsVersion: "v1", updates: [{ type: "TERMS", channel: null, granted: true }, { type: "URGENT_ALERTS", channel: "WHATSAPP", granted: true }] });
  assert.equal(ok.ok, true);
  const bad = [
    { termsVersion: "v1", updates: [] },
    { termsVersion: "v1", updates: [{ type: "CONTACT_SHARING", channel: null, granted: true }] },
    { termsVersion: "v1", updates: [{ type: "URGENT_ALERTS", channel: null, granted: true }] },
    { termsVersion: "v1", updates: [{ type: "TERMS", channel: "WHATSAPP", granted: true }] },
    { termsVersion: "v1", updates: [{ type: "TERMS", channel: null, granted: "yes" }] },
    { termsVersion: "v1", updates: [{ type: "TERMS", channel: null, granted: true }, { type: "TERMS", channel: null, granted: false }] },
    { termsVersion: "v1", updates: [{ type: "TERMS", channel: null, granted: true, userId: "x" }] },
    { updates: [{ type: "TERMS", channel: null, granted: true }] },
  ];
  for (const input of bad) assert.equal(validateConsentUpdate(input).ok, false, JSON.stringify(input));
});

test("donor registration requires age confirmation and bounded, past-only inputs", () => {
  const valid = { bloodGroup: "O-", sex: "FEMALE", travelRadiusKm: 10, ageConfirmed: true };
  assert.equal(validateDonorRegistration(valid, now).ok, true);
  assert.equal(validateDonorRegistration({ ...valid, lastDonationAt: "2025-11-01T00:00:00.000Z" }, now).ok, true);
  for (const extra of [{ ageConfirmed: false }, { travelRadiusKm: 0 }, { travelRadiusKm: 51 }, { sex: "OTHER" }, { lastDonationAt: "2026-06-01T00:00:00.000Z" }, { lastDonationAt: "last month" }, { availability: "AVAILABLE" }]) {
    assert.equal(validateDonorRegistration({ ...valid, ...extra }, now).ok, false, JSON.stringify(extra));
  }
});

test("availability: UNAVAILABLE needs a future end date within a year", () => {
  assert.equal(validateAvailabilityUpdate({ availability: "AVAILABLE" }, now).ok, true);
  assert.equal(validateAvailabilityUpdate({ availability: "UNAVAILABLE", unavailableUntil: "2026-02-01T00:00:00.000Z" }, now).ok, true);
  for (const input of [{ availability: "UNAVAILABLE" }, { availability: "UNAVAILABLE", unavailableUntil: "2025-12-01T00:00:00.000Z" }, { availability: "UNAVAILABLE", unavailableUntil: "2028-01-01T00:00:00.000Z" }, { availability: "PAUSED", unavailableUntil: "2026-02-01T00:00:00.000Z" }, { availability: "BUSY" }]) {
    assert.equal(validateAvailabilityUpdate(input, now).ok, false, JSON.stringify(input));
  }
});

test("location must be inside India, use an allowed source and a printable label", () => {
  assert.equal(validateLocationUpdate({ lat: 18.5204, lng: 73.8567, source: "APP_GPS", areaLabel: " Kothrud " }).ok, true);
  for (const input of [{ lat: 73.8567, lng: 18.5204, source: "APP_GPS" }, { lat: 51.5, lng: -0.12, source: "APP_GPS" }, { lat: 18.5, lng: 73.8, source: "TELEPORT" }, { lat: 18.5, lng: 73.8, source: "APP_GPS", areaLabel: "" }, { lat: 18.5, lng: 73.8, source: "APP_GPS", areaLabel: "bad\u0000label" }]) {
    assert.equal(validateLocationUpdate(input).ok, false, JSON.stringify(input));
  }
  assert.equal(validateLocationUpdate({ lat: 18.5, lng: 73.8, source: "WHATSAPP_SHARE" }, ["APP_GPS", "MANUAL_ENTRY"]).ok, false);
});