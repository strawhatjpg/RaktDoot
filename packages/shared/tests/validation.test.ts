import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidIdempotencyKey, validateCreateBloodRequest } from "../src/validation.ts";

const now = new Date("2026-01-01T00:00:00.000Z");
const valid = { hospitalId: "demo-hospital-1", bloodGroup: "B+", component: "PACKED_RED_CELLS", units: 2, neededBy: "2026-01-02T12:00:00.000Z", language: "hi-Latn", confirmed: true };

test("confirmed canonical intake validates", () => {
  assert.deepEqual(validateCreateBloodRequest(valid, now), { ok: true, value: valid });
});
test("rejects unconfirmed, unknown, malformed and privileged inputs", () => {
  for (const input of [null, [], "text", { ...valid, confirmed: false }, { ...valid, component: "UNKNOWN" }, { ...valid, role: "ADMIN" }, { ...valid, requesterId: "someone-else" }, { ...valid, units: 0 }, { ...valid, units: 1.5 }, { ...valid, units: "2" }, { ...valid, bloodGroup: "B positive" }]) {
    assert.equal(validateCreateBloodRequest(input, now).ok, false);
  }
});
test("rejects past, ambiguous and impossible dates", () => {
  for (const neededBy of ["yesterday", "2026-01-01T00:00:00.000Z", "2026-02-30T12:00:00.000Z", "2026-01-02T12:00:00"]) {
    assert.equal(validateCreateBloodRequest({ ...valid, neededBy }, now).ok, false);
  }
});
test("idempotency keys are bounded and reject whitespace", () => {
  assert.equal(isValidIdempotencyKey("wa:message-123"), true);
  for (const key of [null, "short", "a".repeat(129), "message id"]) assert.equal(isValidIdempotencyKey(key), false);
});