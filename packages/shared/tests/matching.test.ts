import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateDonor, rankDonors, wavePlan, type DonorCandidateInput, type MatchTarget } from "../src/matching.ts";

const now = new Date("2026-10-10T12:00:00.000Z");
const target: MatchTarget = { bloodGroup: "B+", component: "PACKED_RED_CELLS", hospital: { lat: 18.52, lng: 73.85 }, maxRadiusKm: 10 };
const donor = (over: Partial<DonorCandidateInput> = {}): DonorCandidateInput => ({
  donorId: "d1", displayName: "Asha", bloodGroup: "B+", sex: "FEMALE", availability: "AVAILABLE", unavailableUntil: null,
  availabilityUpdatedAt: new Date("2026-10-10T08:00:00.000Z"), travelRadiusKm: 15, lastDonationAt: null,
  location: { lat: 18.53, lng: 73.86, updatedAt: new Date("2026-10-01T00:00:00.000Z") },
  hasAlertConsent: true, committedElsewhere: false, alreadyInvited: false, isRequester: false, alertsLast14Days: 0, ...over,
});

test("an available, consented, nearby donor of the exact group is eligible with reasons", () => {
  const result = evaluateDonor(donor(), target, now);
  assert.equal(result.eligible, true);
  if (result.eligible) {
    assert.ok(result.score > 0.8 && result.score <= 1);
    assert.equal(result.reasons.length, 3);
    assert.match(result.reasons[0]!, /km straight-line/);
  }
});

test("every hard filter excludes with a specific reason", () => {
  const cases: Array<[Partial<DonorCandidateInput>, string]> = [
    [{ isRequester: true }, "IS_REQUESTER"],
    [{ bloodGroup: "O-" }, "BLOOD_GROUP_MISMATCH"],
    [{ hasAlertConsent: false }, "NO_ALERT_CONSENT"],
    [{ availability: "PAUSED" }, "NOT_AVAILABLE"],
    [{ availability: "UNAVAILABLE", unavailableUntil: new Date("2026-11-01T00:00:00.000Z") }, "NOT_AVAILABLE"],
    [{ alreadyInvited: true }, "ALREADY_INVITED"],
    [{ committedElsewhere: true }, "ALREADY_COMMITTED"],
    [{ location: null }, "NO_LOCATION"],
    [{ location: { lat: 18.53, lng: 73.86, updatedAt: new Date("2026-01-01T00:00:00.000Z") } }, "LOCATION_STALE"],
    [{ location: { lat: 19.07, lng: 72.87, updatedAt: now } }, "OUT_OF_RADIUS"],
    [{ travelRadiusKm: 1 }, "OUT_OF_RADIUS"],
    [{ lastDonationAt: new Date("2026-08-01T00:00:00.000Z") }, "RECENT_DONATION"],
  ];
  for (const [over, reason] of cases) assert.deepEqual(evaluateDonor(donor(over), target, now), { eligible: false, donorId: "d1", reason }, reason);
});

test("expired UNAVAILABLE never counts as AVAILABLE", () => {
  const r = evaluateDonor(donor({ availability: "UNAVAILABLE", unavailableUntil: new Date("2026-10-01T00:00:00.000Z") }), target, now);
  assert.equal(r.eligible, false);
});

test("ranking prefers nearer, fresher, less-alerted donors and reports exclusions", () => {
  const { eligible, excluded } = rankDonors([
    donor({ donorId: "far", location: { lat: 18.58, lng: 73.9, updatedAt: now } }),
    donor({ donorId: "near", location: { lat: 18.521, lng: 73.851, updatedAt: now } }),
    donor({ donorId: "tired", location: { lat: 18.521, lng: 73.851, updatedAt: now }, alertsLast14Days: 5 }),
    donor({ donorId: "wrong", bloodGroup: "A+" }),
  ], target, now);
  assert.deepEqual(eligible.map((d) => d.donorId), ["near", "tired", "far"]);
  assert.deepEqual(excluded, { BLOOD_GROUP_MISMATCH: 1 });
});

test("wave plan widens radius and size", () => {
  assert.deepEqual([1, 2, 3].map((n) => wavePlan(n)?.radiusKm), [10, 25, 50]);
  assert.equal(wavePlan(4), null);
});