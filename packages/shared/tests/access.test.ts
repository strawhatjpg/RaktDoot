import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessHospitalCases, canReadBloodRequest, type ActorContext } from "../src/access.ts";

const actor: ActorContext = { userId: "u1", role: "REQUESTER", verified: false, hospitalId: null, district: null };
const request = { requesterId: "u1", hospitalId: "h1", district: "Pune" };
test("owners can read their own cases but not another user's", () => {
  assert.equal(canReadBloodRequest(actor, request), true);
  assert.equal(canReadBloodRequest({ ...actor, userId: "u2" }, request), false);
});
test("staff access requires verification and matching scope", () => {
  assert.equal(canAccessHospitalCases({ ...actor, role: "ADMIN" }, "h1", "Pune"), false);
  assert.equal(canAccessHospitalCases({ ...actor, role: "HOSPITAL_STAFF", verified: true, hospitalId: "h1" }, "h1", "Pune"), true);
  assert.equal(canAccessHospitalCases({ ...actor, role: "HOSPITAL_STAFF", verified: true, hospitalId: "h2" }, "h1", "Pune"), false);
  assert.equal(canAccessHospitalCases({ ...actor, role: "COORDINATOR", verified: true, district: "Pune" }, "h1", "Pune"), true);
  assert.equal(canAccessHospitalCases({ ...actor, role: "COORDINATOR", verified: true, district: "Mumbai" }, "h1", "Pune"), false);
});