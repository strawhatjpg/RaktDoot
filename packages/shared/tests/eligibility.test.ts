import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntilEligible, isPastDonationInterval, provisionalNextEligibleDate } from "../src/eligibility.ts";

const last = new Date("2026-01-01T00:00:00Z");

test("male interval is 90 days, female and unspecified 120 days", () => {
  assert.equal(provisionalNextEligibleDate(last, "MALE").toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(provisionalNextEligibleDate(last, "FEMALE").toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(provisionalNextEligibleDate(last, "UNSPECIFIED").toISOString(), "2026-05-01T00:00:00.000Z");
});

test("first-time donors are past the interval", () => {
  assert.equal(isPastDonationInterval(null, "FEMALE"), true);
  assert.equal(daysUntilEligible(null, "MALE"), 0);
});

test("interval boundary and remaining days", () => {
  assert.equal(isPastDonationInterval(last, "MALE", new Date("2026-03-31T23:59:59Z")), false);
  assert.equal(isPastDonationInterval(last, "MALE", new Date("2026-04-01T00:00:00Z")), true);
  assert.equal(daysUntilEligible(last, "MALE", new Date("2026-03-30T00:00:00Z")), 2);
});

test("invalid date throws", () => {
  assert.throws(() => provisionalNextEligibleDate(new Date("nope"), "MALE"), RangeError);
});