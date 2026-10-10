import { test } from "node:test";
import assert from "node:assert/strict";
import { ForecastServiceError, createForecastClient, forecastClientFromEnv } from "../src/forecast-client.ts";
import { SAMPLE_FORECAST } from "./helpers.ts";

function fakeFetch(status: number, body: unknown, calls: Array<{ url: string; init?: RequestInit }> = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
}

test("posts a validated query and returns the parsed contract", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createForecastClient({ baseUrl: "http://svc:8000/", fetchImpl: fakeFetch(200, SAMPLE_FORECAST, calls) });
  const result = await client.forecast({ district: "Pune", horizonWeeks: 2, components: ["PLATELETS"] });
  assert.equal(result.isSynthetic, true);
  assert.equal(calls[0]?.url, "http://svc:8000/forecast");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { district: "Pune", horizonWeeks: 2, components: ["PLATELETS"] });
});

test("rejects invalid queries before calling the service", async () => {
  const calls: Array<{ url: string }> = [];
  const client = createForecastClient({ baseUrl: "http://svc", fetchImpl: fakeFetch(200, SAMPLE_FORECAST, calls) });
  const bad = [
    { district: "Pune", horizonWeeks: 5 },
    { district: " ", horizonWeeks: 1 },
    { district: "Pune", horizonWeeks: 1, components: ["UNKNOWN"] },
    { district: "Pune", horizonWeeks: 1, bloodGroups: ["B+ve"] },
  ];
  for (const query of bad) {
    await assert.rejects(client.forecast(query as never), (e: unknown) => e instanceof ForecastServiceError && e.status === 400);
  }
  assert.equal(calls.length, 0);
});

test("surfaces HTTP errors with status and detail", async () => {
  const client = createForecastClient({ baseUrl: "http://svc", fetchImpl: fakeFetch(404, { detail: "Unknown district 'X'" }) });
  await assert.rejects(client.forecast({ district: "X", horizonWeeks: 1 }), (e: unknown) =>
    e instanceof ForecastServiceError && e.status === 404 && /Unknown district/.test(e.message));
});

test("rejects malformed service responses (schema-validated)", async () => {
  const crossing = structuredClone(SAMPLE_FORECAST);
  crossing.points[0]!.p10 = 999;
  for (const body of [{ nope: true }, crossing, "not json"]) {
    const client = createForecastClient({ baseUrl: "http://svc", fetchImpl: fakeFetch(200, body) });
    await assert.rejects(client.forecast({ district: "Pune", horizonWeeks: 1 }), (e: unknown) =>
      e instanceof ForecastServiceError && e.status === 502);
  }
});

test("network failures become ForecastServiceError with null status", async () => {
  const failing = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  const client = createForecastClient({ baseUrl: "http://svc", fetchImpl: failing });
  await assert.rejects(client.health(), (e: unknown) => e instanceof ForecastServiceError && e.status === null);
});

test("backtest encodes the district; bad base URLs are refused", async () => {
  const calls: Array<{ url: string }> = [];
  const body = { district: "Navi Mumbai", isSynthetic: true, modelMae: 1, baselineMae: 2, weeksTested: 3, intervalCoverage: 0.8, weekly: [] };
  const client = createForecastClient({ baseUrl: "http://svc", fetchImpl: fakeFetch(200, body, calls) });
  await client.backtest("Navi Mumbai");
  assert.equal(calls[0]?.url, "http://svc/backtest?district=Navi%20Mumbai");
  assert.throws(() => createForecastClient({ baseUrl: "svc:8000" }));
  assert.doesNotThrow(() => forecastClientFromEnv({}));
});
