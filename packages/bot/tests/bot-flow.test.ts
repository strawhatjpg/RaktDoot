import { test } from "node:test";
import assert from "node:assert/strict";
import { processInbound, BTN, type BotDeps } from "../src/conversation/bot-flow.ts";
import { createMockCoreApi } from "../src/core-api.ts";
import { toInbound } from "../src/channels/simulator-adapter.ts";
import { createMemoryLoginStore, createWhatsAppLogin } from "../src/auth/whatsapp-login.ts";
import type { LlmClient } from "../src/ai/llm-client.ts";
import { missingKeys, CATALOG_BY_LANGUAGE } from "../src/i18n/t.ts";

const NOW = new Date("2026-10-10T06:30:00Z"); // 12:00 IST
const PHONE = "+919800000001";

function setup(llm: LlmClient | null = null) {
  const core = createMockCoreApi();
  const login = createWhatsAppLogin(createMemoryLoginStore(), () => NOW.getTime());
  const deps: BotDeps = { core, llm, login, appBaseUrl: "http://localhost:3000", now: () => NOW };
  const say = (input: { text?: string; buttonId?: string; location?: { lat: number; lng: number } }) =>
    processInbound(toInbound({ from: PHONE, ...input }, NOW), deps);
  return { core, deps, say, login };
}

async function onboard(say: ReturnType<typeof setup>["say"], first = "Namaste ji", lang: string = BTN.LANG_HI) {
  await say({ text: first });
  await say({ buttonId: lang });
  await say({ buttonId: BTN.TERMS_YES });
}

test("every language defines every message; button titles fit WhatsApp's 20-char limit", () => {
  assert.deepEqual(missingKeys(), []);
  for (const catalog of Object.values(CATALOG_BY_LANGUAGE))
    for (const [k, v] of Object.entries(catalog)) if (k.startsWith("btn_")) assert.ok([...v].length <= 20, `${k}: ${v}`);
});

test("Hinglish requester, no AI: follow-up for component, confirm, request created", async () => {
  const { core, say } = setup(null);
  const first = await say({ text: "Namaste ji" });
  assert.equal(first[0]!.kind, "buttons", "language picker");
  await say({ buttonId: BTN.LANG_HI });
  const role = await say({ buttonId: BTN.TERMS_YES });
  assert.match(role[0]!.text, /madad/);
  const intake = await say({ buttonId: BTN.ROLE_NEED });
  assert.match(intake[0]!.text, /bhasha/);

  const q = await say({ text: "Ruby Hall Hospital mein B positive ke 2 unit chahiye, aaj shaam 6 baje tak" });
  assert.equal(q[0]!.kind, "buttons");
  assert.match(q[0]!.text, /component/, "asks only for the missing component");

  const card = await say({ buttonId: BTN.COMP_PLT });
  assert.match(card[0]!.text, /Ruby Hall Hospital/);
  assert.match(card[0]!.text, /B\+/);
  assert.match(card[0]!.text, /Platelets/);
  assert.match(card[0]!.text, /6:00 pm/i);

  const done = await say({ buttonId: BTN.CONFIRM });
  assert.match(done[0]!.text, /RD-1001/);
  assert.equal(core.requests.length, 1);
  assert.deepEqual(
    { ...core.requests[0], originalText: undefined },
    { requesterPhone: PHONE, hospitalName: "Ruby Hall Hospital", bloodGroup: "B+", component: "PLATELETS", units: 2,
      neededBy: "2026-10-10T12:30:00.000Z", language: "hi-Latn", originalText: undefined },
  );
});

test("AI output is validated: bad values are dropped and re-asked, never trusted", async () => {
  const llm: LlmClient = {
    async completeJson() {
      return { hospitalName: "Sassoon Hospital", bloodGroup: "B", component: "blood", units: 99, neededBy: "yesterday", confidence: { hospitalName: 0.9 } };
    },
    async completeText() { return ""; },
  };
  const { core, say } = setup(llm);
  await onboard(say, "नमस्ते");
  await say({ buttonId: BTN.ROLE_NEED });
  const q = await say({ text: "Sassoon mein khoon chahiye" });
  // First message was Devanagari, so "Hindi" button → Devanagari replies.
  assert.match(q[0]!.text, /ब्लड ग्रुप/, "Rh sign missing → asks blood group");
  const q2 = await say({ text: "O negative" });
  assert.match(q2[0]!.text, /कंपोनेंट/);
  await say({ buttonId: BTN.NOT_SURE });
  const q3 = await say({ text: "do unit" });
  assert.match(q3[0]!.text, /कब तक/);
  const card = await say({ buttonId: BTN.NOT_SURE });
  assert.match(card[0]!.text, /O-/);
  await say({ buttonId: BTN.CONFIRM });
  assert.equal(core.requests[0]!.units, 2);
  assert.equal(core.requests[0]!.component, "UNKNOWN");
  assert.equal(core.requests[0]!.neededBy, null);
});

test("donor: separate consents in chat, location pin stored coarsely, blood group saved", async () => {
  const { core, say } = setup(null);
  await onboard(say, "hello", BTN.LANG_EN);
  const a = await say({ buttonId: BTN.ROLE_DONATE });
  assert.match(a[0]!.text, /urgently/);
  await say({ buttonId: BTN.YES });
  await say({ buttonId: BTN.NO });
  const loc = await say({ buttonId: BTN.YES });
  assert.equal(loc[1]!.kind, "location_request");
  await say({ location: { lat: 18.51234, lng: 73.85678 } });
  const g = await say({ text: "o+ve" });
  assert.match(g[0]!.text, /Saved/);
  assert.deepEqual(core.consents.map((x) => [x.type, x.granted]), [
    ["TERMS", true], ["URGENT_ALERTS", true], ["DONATION_REMINDERS", false], ["LOCATION_STORAGE", true],
  ]);
  assert.deepEqual([core.locations[0]!.lat, core.locations[0]!.lng], [18.51, 73.86]);
});

test("STOP withdraws alert + reminder consent; LOGIN code binds to the WhatsApp number", async () => {
  const { core, say, login } = setup(null);
  await onboard(say);
  await say({ text: "STOP" });
  assert.deepEqual(core.consents.slice(-2).map((x) => [x.type, x.granted]), [["URGENT_ALERTS", false], ["DONATION_REMINDERS", false]]);
  const { code } = await login.start("919800000000");
  const r = await say({ text: `LOGIN ${code}` });
  assert.match(r[0]!.text, /login/i);
  assert.deepEqual(await login.poll(code), { status: "confirmed", phone: PHONE });
});

test("donor invite button reply is forwarded to core", async () => {
  const { core, say } = setup(null);
  await onboard(say);
  await say({ buttonId: "invite:inv-7:accept" });
  assert.deepEqual(core.inviteResponses, [{ phone: PHONE, inviteId: "inv-7", response: "ACCEPT" }]);
});

test("off-topic messages get a task-specific fallback, not a chatbot answer", async () => {
  const { say } = setup(null);
  await onboard(say, "hi", BTN.LANG_EN);
  await say({ buttonId: BTN.ROLE_DONATE });
  // finish onboarding quickly
  await say({ buttonId: BTN.NO }); await say({ buttonId: BTN.NO }); await say({ buttonId: BTN.NO });
  await say({ text: "B+" });
  const r = await say({ text: "what is the capital of France?" });
  assert.match(r[0]!.text, /only/);
});