/** M1 fixes found while integrating with M2's Prisma CoreApi (see docs/CHALLENGES.md). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { processInbound, BTN, type BotDeps } from "../src/conversation/bot-flow.ts";
import { createMockCoreApi, REQUEST_NOT_CREATED, type CoreApi } from "../src/core-api.ts";
import { toInbound } from "../src/channels/simulator-adapter.ts";
import { ruleHospital } from "../src/ai/extract-request.ts";

const NOW = new Date("2026-10-10T06:30:00Z");
const PHONE = "+919800000042";

function bot(core: CoreApi) {
  const deps: BotDeps = { core, llm: null, appBaseUrl: "http://x", now: () => NOW };
  return (i: { text?: string; buttonId?: string }) => processInbound(toInbound({ from: PHONE, ...i }, NOW), deps);
}

test("hospital names keep a trailing branch number but not a quantity or time", () => {
  assert.equal(ruleHospital("FICTIONAL Demo Hospital 1 mein O- chahiye"), "FICTIONAL Demo Hospital 1");
  assert.equal(ruleHospital("City Hospital No. 2, B+"), "City Hospital No. 2");
  assert.equal(ruleHospital("Ruby Hall Hospital 2 unit B+"), "Ruby Hall Hospital");
  assert.equal(ruleHospital("Ruby Hall Hospital 6 baje tak"), "Ruby Hall Hospital");
  assert.equal(ruleHospital("Ruby Hall Hospital 3 units"), "Ruby Hall Hospital");
});

test("unknown hospital: draft is kept, only the hospital is asked again, then the request is created", async () => {
  const mock = createMockCoreApi();
  let calls = 0;
  const core: CoreApi = {
    ...mock,
    async createRequest(input) {
      calls++;
      if (/nowhere/i.test(input.hospitalName)) {
        return { id: REQUEST_NOT_CREATED, trackUrl: "http://x/request\nWe couldn't match it. (e.g. FICTIONAL Demo Hospital 1, FICTIONAL Demo Hospital 2)" };
      }
      return mock.createRequest(input);
    },
  };
  const say = bot(core);
  await say({ text: "hello" });
  await say({ buttonId: BTN.LANG_EN });
  await say({ buttonId: BTN.TERMS_YES });
  await say({ buttonId: BTN.ROLE_NEED });
  const card = await say({ text: "Nowhere Hospital O- packed red cells 1 unit today 6 pm" });
  assert.match(card[0]!.text, /Nowhere Hospital/);

  const retry = await say({ buttonId: BTN.CONFIRM });
  assert.match(retry[0]!.text, /couldn't find that hospital/);
  assert.match(retry[0]!.text, /FICTIONAL Demo Hospital 1, FICTIONAL Demo Hospital 2/);
  assert.doesNotMatch(retry[0]!.text, /NOT CREATED/);

  const fixed = await say({ text: "FICTIONAL Demo Hospital 1" });
  assert.match(fixed[0]!.text, /FICTIONAL Demo Hospital 1/, "back to the confirm card with the rest kept");
  assert.match(fixed[0]!.text, /O-/);
  const done = await say({ buttonId: BTN.CONFIRM });
  assert.match(done[0]!.text, /RD-1001/);
  assert.equal(calls, 2);
  assert.equal(mock.requests[0]!.hospitalName, "FICTIONAL Demo Hospital 1");
  assert.equal(mock.requests[0]!.units, 1);
});

test("typed area sends no fake 0,0 coordinates", async () => {
  const core = createMockCoreApi();
  const say = bot(core);
  await say({ text: "hello" });
  await say({ buttonId: BTN.LANG_EN });
  await say({ buttonId: BTN.TERMS_YES });
  await say({ buttonId: BTN.ROLE_DONATE });
  await say({ buttonId: BTN.YES });
  await say({ buttonId: BTN.YES });
  await say({ buttonId: BTN.YES });
  const r = await say({ text: "Kothrud" });
  assert.match(r[0]!.text, /Kothrud/);
  const loc = core.locations[0]!;
  assert.equal(loc.source, "MANUAL_ENTRY");
  assert.ok(Number.isNaN(loc.lat) && Number.isNaN(loc.lng), "no coordinates for a typed area");
});

test("DELETE MY DATA reply says the data is deleted (it is erased immediately)", async () => {
  const say = bot(createMockCoreApi());
  await say({ text: "hello" });
  await say({ buttonId: BTN.LANG_EN });
  await say({ buttonId: BTN.TERMS_YES });
  const r = await say({ text: "DELETE MY DATA" });
  assert.match(r[0]!.text, /has been deleted/);
  assert.doesNotMatch(r[0]!.text, /7 days/);
});
