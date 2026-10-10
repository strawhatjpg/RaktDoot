import { test } from "node:test";
import assert from "node:assert/strict";
import { ApprovalStore } from "../src/approval.ts";
import { COPILOT_SYSTEM_PROMPT, createCopilot, isRateLimitError, providersFromEnv } from "../src/agent.ts";
import { buildShortageBriefing, formatBriefing } from "../src/briefing.ts";
import { createMockDataSource } from "../src/mock-data.ts";
import { agentWithModel, fakeForecastClient, noSleep, scriptedModel } from "./helpers.ts";

const GEMINI = { providerId: "gemini" as const, modelId: "test-flash", apiKey: "k1" };
const GROQ = { providerId: "groq" as const, modelId: "test-oss", apiKey: "k2" };

function deps() {
  const data = createMockDataSource();
  return { data, forecast: fakeForecastClient(), approvals: new ApprovalStore({ data }) };
}

test("runs the real Cline SDK loop: tools are called and a draft is created, nothing sent", async () => {
  const d = deps();
  const model = scriptedModel(
    [
      { tool: "get_open_requests", input: {} },
      { tool: "get_forecast", input: { district: "Pune", horizonWeeks: 2 } },
      { tool: "draft_outreach_message", input: { kind: "DONOR_OUTREACH", requestId: "REQ-1001", rationale: "2 units uncovered" } },
    ],
    (results) => `Saw ${results.length} tool results. Draft awaits coordinator approval.`,
  );
  const copilot = createCopilot({ ...d, providers: [GEMINI], createAgent: agentWithModel(model) });
  const answer = await copilot.ask("Which requests are at risk?");

  assert.equal(answer.text, "Saw 3 tool results. Draft awaits coordinator approval.");
  assert.deepEqual(answer.toolsUsed, ["get_open_requests", "get_forecast", "draft_outreach_message"]);
  assert.equal(answer.draftIds.length, 1);
  assert.equal(d.approvals.get(answer.draftIds[0]!)?.status, "PENDING_APPROVAL");
  assert.equal(answer.provider, "gemini:test-flash");
});

test("falls back to Groq when Gemini is rate-limited (429)", async () => {
  const d = deps();
  const seen: string[] = [];
  const copilot = createCopilot({
    ...d,
    providers: [GEMINI, GROQ],
    sleep: noSleep,
    createAgent: (config) => {
      seen.push(config.providerId);
      if (config.providerId === "gemini") {
        return { run: async () => { throw Object.assign(new Error("429 RESOURCE_EXHAUSTED"), { status: 429 }); } };
      }
      return agentWithModel(scriptedModel([], () => "ok from groq"))(config);
    },
  });
  const answer = await copilot.ask("hi");
  assert.equal(answer.text, "ok from groq");
  assert.equal(answer.provider, "groq:test-oss");
  assert.deepEqual(seen, ["gemini", "gemini", "groq"]); // one backoff retry, then fallback
});

test("non-rate-limit errors are not retried", async () => {
  let calls = 0;
  const copilot = createCopilot({
    ...deps(),
    providers: [GEMINI, GROQ],
    sleep: noSleep,
    createAgent: () => ({ run: async () => { calls++; throw new Error("invalid API key"); } }),
  });
  await assert.rejects(copilot.ask("hi"), /invalid API key/);
  assert.equal(calls, 1);
});

test("validates the question and requires a provider", async () => {
  assert.throws(() => createCopilot({ ...deps(), providers: [] }), /No LLM provider/);
  const copilot = createCopilot({ ...deps(), providers: [GEMINI], createAgent: agentWithModel(scriptedModel([], () => "x")) });
  await assert.rejects(copilot.ask("   "), /empty/);
  await assert.rejects(copilot.ask("a".repeat(2001)), /longer than/);
});

test("providersFromEnv ignores missing keys and placeholder models", () => {
  assert.deepEqual(providersFromEnv({}), []);
  assert.deepEqual(providersFromEnv({ GEMINI_API_KEY: "k", GEMINI_MODEL: "replace-with-free-flash-model-id" }), []);
  const both = providersFromEnv({ GEMINI_API_KEY: "a", GEMINI_MODEL: "m1", GROQ_API_KEY: "b", GROQ_MODEL: "m2" });
  assert.deepEqual(both.map((p) => p.providerId), ["gemini", "groq"]);
});

test("rate-limit detection and system prompt guardrails", () => {
  assert.equal(isRateLimitError(new Error("Too Many Requests")), true);
  assert.equal(isRateLimitError(new Error("quota exceeded")), true);
  assert.equal(isRateLimitError(new Error("bad request")), false);
  for (const rule of [/never decide clinical urgency/i, /cannot send messages/i, /VERIFIED requests/, /synthetic data/, /may be eligible/]) {
    assert.match(COPILOT_SYSTEM_PROMPT, rule);
  }
});

test("shortage briefing is deterministic and labelled synthetic", async () => {
  const d = deps();
  const briefing = await buildShortageBriefing(d, "Pune");
  assert.equal(briefing.highRisk.length, 1);
  assert.equal(briefing.highRisk[0]?.component, "PLATELETS");
  assert.deepEqual(briefing.awaitingVerification, ["REQ-1002"]);
  assert.deepEqual(briefing.outreachActive, ["REQ-1001"]);
  const text = formatBriefing(briefing);
  assert.match(text, /synthetic data/);
  assert.match(text, /risk 83%/);
});

test("briefing ignores tiny series whose risk is mostly noise", async () => {
  const d = deps();
  const tiny = structuredClone((await d.forecast.forecast({ district: "Pune", horizonWeeks: 1 })));
  tiny.points = [{ ...tiny.points[0]!, bloodGroup: "B-", p10: 1, p50: 2, p90: 5, expectedSupply: 0, shortageRisk: 0.9 }];
  const briefing = await buildShortageBriefing({ data: d.data, forecast: fakeForecastClient(tiny) }, "Pune");
  assert.equal(briefing.highRisk.length, 0);
});
