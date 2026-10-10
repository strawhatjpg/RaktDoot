/** Regression tests for bugs found while debugging the m1 branch (see docs/CHALLENGES.md). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { processInbound, BTN, type BotDeps } from "../src/conversation/bot-flow.ts";
import { createMockCoreApi } from "../src/core-api.ts";
import { toInbound } from "../src/channels/simulator-adapter.ts";
import { normalizeBloodGroup } from "../src/ai/normalize.ts";
import { parseNeededBy } from "../src/ai/parse-time.ts";
import { validateAiOutput, ruleHospital, ruleBasedExtract } from "../src/ai/extract-request.ts";

const NOW = new Date("2026-10-10T06:30:00Z"); // 12:00 IST

function bot() {
  const core = createMockCoreApi();
  const deps: BotDeps = { core, llm: null, appBaseUrl: "http://x", now: () => NOW };
  const say = async (i: { text?: string; buttonId?: string; location?: { lat: number; lng: number } }) =>
    processInbound(toInbound({ from: "+919800000009", ...i }, NOW), deps);
  return { core, say };
}

test("addresses like 'Wing A-2' / 'Bed B+12' are not blood groups", () => {
  assert.equal(normalizeBloodGroup("Ruby Hall, Wing A-2, need blood"), null);
  assert.equal(normalizeBloodGroup("bed no B-12"), null);
  assert.equal(normalizeBloodGroup("A-2 ward, patient is O-"), "O-");
});

test("time parser: whole words only, '2 unit' is not 2 o'clock, urgency is not invented", () => {
  assert.equal(parseNeededBy("Kalyani Hospital", NOW), null);
  assert.equal(parseNeededBy("Abhishek Hospital", NOW), null);
  assert.equal(parseNeededBy("urgent hai", NOW), null);
  assert.equal(parseNeededBy("2 unit 7 baje shaam", NOW), "2026-10-10T13:30:00.000Z");
  assert.equal(parseNeededBy("kal subah", NOW), "2026-10-11T04:30:00.000Z");
  assert.equal(parseNeededBy("आज शाम 6 बजे", NOW), "2026-10-10T12:30:00.000Z");
});

test("AI-reported confidence 0 is respected, not defaulted to 0.7", () => {
  assert.equal(validateAiOutput({ bloodGroup: "B+", confidence: { bloodGroup: 0 } }, NOW).bloodGroup.confidence, 0);
  assert.equal(validateAiOutput({ bloodGroup: "B+" }, NOW).bloodGroup.confidence, 0.7);
});

test("hospital rule: lowercase names and filler words", () => {
  assert.equal(ruleHospital("papa ruby hall hospital mein hain"), "ruby hall hospital");
  assert.equal(ruleHospital("मेरे पापा रूबी हॉल अस्पताल में हैं"), "रूबी हॉल अस्पताल");
  assert.equal(ruleHospital("admitted in hospital"), null);
  assert.equal(ruleBasedExtract("units: 3, B+").units.value, 3);
});

test("a request sent as the very first message is reused after onboarding", async () => {
  const { core, say } = bot();
  await say({ text: "Ruby Hall Hospital mein B+ platelets 2 unit chahiye aaj shaam 6 baje" });
  await say({ buttonId: BTN.LANG_HI });
  const r = await say({ buttonId: BTN.TERMS_YES });
  assert.equal(r[0]!.kind, "buttons");
  assert.match(r[0]!.text, /Ruby Hall Hospital/, "goes straight to the confirm card");
  await say({ buttonId: BTN.CONFIRM });
  assert.equal(core.requests.length, 1);
});

test("short answers fill the asked field; 'not sure' cannot skip required fields", async () => {
  const { core, say } = bot();
  await say({ text: "hello" });
  await say({ buttonId: BTN.LANG_EN });
  await say({ buttonId: BTN.TERMS_YES });
  await say({ buttonId: BTN.ROLE_NEED });
  const q = await say({ text: "Ruby Hall Hospital B+ platelets" });
  assert.match(q[0]!.text, /How many units/);
  const notSure = await say({ buttonId: BTN.NOT_SURE });
  assert.match(notSure[0]!.text, /How many units/, "required field is asked again");
  const next = await say({ text: "2" });
  assert.match(next[0]!.text, /By when/);
  const card = await say({ text: "6 pm" });
  assert.match(card[0]!.text, /6:00 pm/i);
  const fixed = await say({ text: "units 3" });
  assert.match(fixed[0]!.text, /Units: 3/, "correction on the confirm card overrides");
  await say({ buttonId: BTN.CONFIRM });
  assert.equal(core.requests[0]!.units, 3);
});

test("LOCATION mid-request asks consent, saves area, then resumes the request", async () => {
  const { core, say } = bot();
  await say({ text: "hello" });
  await say({ buttonId: BTN.LANG_EN });
  await say({ buttonId: BTN.TERMS_YES });
  await say({ buttonId: BTN.ROLE_NEED });
  await say({ text: "Ruby Hall Hospital B+ platelets" });
  const consent = await say({ text: "LOCATION" });
  assert.match(consent[0]!.text, /approximate area/);
  await say({ buttonId: BTN.YES });
  const resumed = await say({ text: "Kothrud" });
  assert.match(resumed[0]!.text, /Kothrud/);
  assert.match(resumed[1]!.text, /How many units/, "back to the half-finished request");
  assert.equal(core.locations[0]!.source, "MANUAL_ENTRY");
});

test("'नमस्ते' as first message + Hindi → Devanagari replies", async () => {
  const { say } = bot();
  await say({ text: "नमस्ते" });
  await say({ buttonId: BTN.LANG_HI });
  const r = await say({ buttonId: BTN.TERMS_YES });
  assert.match(r[0]!.text, /मदद/);
});