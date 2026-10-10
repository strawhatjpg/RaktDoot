import { test } from "node:test";
import assert from "node:assert/strict";
import { ApprovalStore } from "../src/approval.ts";
import { createMockDataSource } from "../src/mock-data.ts";
import { COPILOT_TOOL_NAMES, createCopilotTools } from "../src/tools.ts";
import { donationCampaignMessage, donorOutreachMessage } from "../src/templates.ts";
import { fakeForecastClient } from "./helpers.ts";

type Exec = (input: unknown, ctx: unknown) => Promise<Record<string, unknown>>;

function setup() {
  const data = createMockDataSource();
  const approvals = new ApprovalStore({ data });
  const forecast = fakeForecastClient();
  const tools = createCopilotTools({ data, forecast, approvals });
  const run = (name: string, input: unknown = {}) => {
    const tool = tools.find((t) => t.name === name);
    assert.ok(tool, `missing tool ${name}`);
    return (tool.execute as unknown as Exec)(input, { agentId: "test", iteration: 1 });
  };
  return { tools, run, approvals, forecast };
}

test("exposes exactly the six read/draft tools; none can send, close or edit", () => {
  const { tools } = setup();
  assert.deepEqual(tools.map((t) => t.name), [...COPILOT_TOOL_NAMES]);
  for (const t of tools) {
    assert.doesNotMatch(t.name, /send|close|edit|update|delete/);
    assert.equal(t.inputSchema.type, "object");
    assert.equal("$schema" in t.inputSchema, false);
  }
});

test("get_open_requests excludes closed requests", async () => {
  const { run } = setup();
  const result = await run("get_open_requests");
  const ids = (result.requests as Array<{ id: string }>).map((r) => r.id);
  assert.equal(ids.includes("REQ-0990"), false);
  assert.equal(result.count, 3);
});

test("rank_donors refuses unverified requests and never exposes phone numbers", async () => {
  const { run } = setup();
  const refused = await run("rank_donors", { requestId: "REQ-1002" });
  assert.match(String(refused.error), /PENDING_REVIEW/);
  const ranked = await run("rank_donors", { requestId: "REQ-1001", limit: 3 });
  assert.equal((ranked.donors as unknown[]).length, 3);
  assert.doesNotMatch(JSON.stringify(ranked), /\+91|phone/i);
});

test("invalid LLM input is returned as an error, not thrown", async () => {
  const { run } = setup();
  assert.match(String((await run("rank_donors", { requestId: "REQ-1001", limit: 50 })).error), /Invalid input/);
  assert.match(String((await run("get_forecast", { district: "Pune", components: ["UNKNOWN"] })).error), /Invalid input/);
  assert.match(String((await run("search_blood_centres", {})).error), /Invalid input/);
});

test("get_forecast labels synthetic data and sorts by risk", async () => {
  const { run, forecast } = setup();
  const result = await run("get_forecast", { district: "Pune" });
  assert.equal(result.label, "Demonstrated on synthetic data");
  const risks = (result.highestRiskPoints as Array<{ shortageRisk: number }>).map((p) => p.shortageRisk);
  assert.deepEqual(risks, [...risks].sort((a, b) => b - a));
  assert.deepEqual(forecast.queries[0], { district: "Pune", horizonWeeks: 4 });
});

test("summarize_case reports confirmed stock and outreach permission", async () => {
  const { run } = setup();
  const result = await run("summarize_case", { requestId: "REQ-1002" });
  assert.equal(result.donorOutreachAllowed, false);
  assert.equal(result.confirmedStockUnits, 4);
  assert.equal((await run("summarize_case", { requestId: "nope" })).error, "Request nope not found");
});

test("draft_outreach_message creates a pending draft only, with reviewed wording", async () => {
  const { run, approvals } = setup();
  const blocked = await run("draft_outreach_message", { kind: "DONOR_OUTREACH", requestId: "REQ-1002", rationale: "x" });
  assert.ok(blocked.error);
  const made = await run("draft_outreach_message", { kind: "DONOR_OUTREACH", requestId: "REQ-1001", rationale: "2 units uncovered" });
  assert.equal(made.status, "PENDING_APPROVAL");
  assert.equal(approvals.list("PENDING_APPROVAL").length, 1);
  assert.equal(approvals.list("APPROVED").length, 0);
  const campaign = await run("draft_outreach_message", {
    kind: "DONATION_CAMPAIGN", district: "Pune", bloodGroup: "O+", component: "PLATELETS", weekStart: "2026-09-28", rationale: "dengue risk",
  });
  assert.equal(campaign.status, "PENDING_APPROVAL");
  const missing = await run("draft_outreach_message", { kind: "DONATION_CAMPAIGN", district: "Pune", rationale: "x" });
  assert.match(String(missing.error), /needs district/);
});

test("templates follow the safety wording rules", () => {
  const texts = [
    donorOutreachMessage({ requestId: "R1", bloodGroup: "O+", component: "PLATELETS", units: 2, hospitalName: "H" }),
    donationCampaignMessage({ district: "Pune", bloodGroup: "B+", component: "PACKED_RED_CELLS", weekStart: "2026-10-05" }),
  ];
  for (const text of texts) {
    assert.match(text, /may be eligible/);
    assert.doesNotMatch(text, /you are eligible|are eligible to/i);
    assert.match(text, /licensed blood centre/);
    assert.match(text, /STOP|PAUSE/);
    assert.doesNotMatch(text, /₹|cash|reward|prize/i);
  }
});
