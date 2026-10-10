import { test } from "node:test";
import assert from "node:assert/strict";
import { hasActiveConsent, reminderChannels, type ConsentRecord } from "../src/consent.ts";

const at = (iso: string) => new Date(iso);

test("no record means no consent", () => {
  assert.equal(hasActiveConsent([], "URGENT_ALERTS", "WHATSAPP"), false);
});

test("latest record wins, so withdrawal overrides grant", () => {
  const records: ConsentRecord[] = [
    { type: "DONATION_REMINDERS", channel: "WHATSAPP", granted: true, recordedAt: at("2026-01-01T00:00:00Z") },
    { type: "DONATION_REMINDERS", channel: "WHATSAPP", granted: false, recordedAt: at("2026-02-01T00:00:00Z") },
  ];
  assert.equal(hasActiveConsent(records, "DONATION_REMINDERS", "WHATSAPP"), false);
});

test("reminders only go to consented channels and require accepted terms", () => {
  const records: ConsentRecord[] = [
    { type: "DONATION_REMINDERS", channel: "APP_PUSH", granted: true, recordedAt: at("2026-01-01T00:00:00Z") },
  ];
  assert.deepEqual(reminderChannels(records, ["WHATSAPP", "APP_PUSH"]), []);

  records.push({ type: "TERMS", channel: null, granted: true, recordedAt: at("2026-01-01T00:00:00Z") });
  assert.deepEqual(reminderChannels(records, ["WHATSAPP", "APP_PUSH"]), ["APP_PUSH"]);
});