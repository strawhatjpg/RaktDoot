import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedNextStatuses, canVerifyRequests, checkTransition } from "../src/lifecycle.ts";

test("unverified requests can list centres but cannot start donor outreach", () => {
  assert.deepEqual(checkTransition("OPEN", "CENTRES_LISTED", { actorRole: "REQUESTER", verification: "UNVERIFIED" }), { ok: true });
  const blocked = checkTransition("CENTRES_LISTED", "OUTREACH_ACTIVE", { actorRole: "COORDINATOR", verification: "UNVERIFIED" });
  assert.equal(blocked.ok, false);
  assert.deepEqual(checkTransition("CENTRES_LISTED", "OUTREACH_ACTIVE", { actorRole: "COORDINATOR", verification: "VERIFIED" }), { ok: true });
});

test("invalid jumps are rejected (donor accepted is not fulfilment)", () => {
  assert.equal(checkTransition("OPEN", "DONATION_CONFIRMED", { actorRole: "ADMIN", verification: "VERIFIED" }).ok, false);
});

test("donation confirmation requires blood centre staff or coordinator", () => {
  assert.equal(checkTransition("DONOR_ARRIVED", "DONATION_CONFIRMED", { actorRole: "DONOR", verification: "VERIFIED" }).ok, false);
  assert.equal(checkTransition("DONOR_ARRIVED", "DONATION_CONFIRMED", { actorRole: "BLOOD_CENTRE_STAFF", verification: "VERIFIED" }).ok, true);
});

test("closing needs an outcome; requesters may only cancel their own", () => {
  const base = { verification: "VERIFIED" as const };
  assert.equal(checkTransition("OUTREACH_ACTIVE", "CLOSED", { ...base, actorRole: "COORDINATOR" }).ok, false);
  assert.equal(checkTransition("OUTREACH_ACTIVE", "CLOSED", { ...base, actorRole: "COORDINATOR", outcome: "FULFILLED" }).ok, true);
  assert.equal(checkTransition("OPEN", "CLOSED", { ...base, actorRole: "REQUESTER", outcome: "FULFILLED", actorIsOwner: true }).ok, false);
  assert.equal(checkTransition("OPEN", "CLOSED", { ...base, actorRole: "REQUESTER", outcome: "CANCELLED", actorIsOwner: true }).ok, true);
  assert.equal(checkTransition("OPEN", "CLOSED", { ...base, actorRole: "REQUESTER", outcome: "CANCELLED", actorIsOwner: false }).ok, false);
});

test("closed requests can only be reopened by staff", () => {
  assert.deepEqual(allowedNextStatuses("CLOSED"), ["OPEN"]);
  assert.equal(checkTransition("CLOSED", "OPEN", { actorRole: "REQUESTER", verification: "VERIFIED" }).ok, false);
  assert.equal(checkTransition("CLOSED", "OPEN", { actorRole: "HOSPITAL_STAFF", verification: "VERIFIED" }).ok, true);
});

test("only institutional roles verify requests", () => {
  assert.equal(canVerifyRequests("REQUESTER"), false);
  assert.equal(canVerifyRequests("DONOR"), false);
  assert.equal(canVerifyRequests("HOSPITAL_STAFF"), true);
});