import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, apiError, readJson } from "../src/server/http.ts";

test("HTTP helper requires JSON and rejects malformed or oversized input", async () => {
  await assert.rejects(readJson(new Request("http://localhost", { method: "POST", body: "hello" })), (error: unknown) => error instanceof ApiError && error.status === 415);
  for (const [body, status] of [["{", 400], ["x".repeat(17000), 413]] as const) {
    await assert.rejects(readJson(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body })), (error: unknown) => error instanceof ApiError && error.status === status);
  }
});

test("HTTP errors are structured and never cache sensitive responses", async () => {
  const response = apiError(new ApiError(400, "VALIDATION_ERROR", "Check fields", { units: "Invalid" }));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: { code: "VALIDATION_ERROR", message: "Check fields", fields: { units: "Invalid" } } });
});