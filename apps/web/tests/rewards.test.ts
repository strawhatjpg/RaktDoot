// Coins, referrals and the sponsor coupon store, against real route handlers and the DB.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BTN, processInbound, toInbound, type BotDeps } from "@raktdoot/bot";
import { getDb } from "../src/server/db.ts";
import { createSession } from "../src/server/auth/session.ts";
import { createPrismaCoreApi } from "../src/server/bot/core-adapter.ts";
import { recordReferral } from "../src/server/bot/index.ts";
import { attachReferral, getOrCreateReferralCode } from "../src/server/rewards/service.ts";
import { respondToInvite } from "../src/server/outreach/service.ts";
import { GET as wallet } from "../src/app/api/rewards/route.ts";
import { GET as store } from "../src/app/api/rewards/store/route.ts";
import { POST as redeem } from "../src/app/api/rewards/redeem/route.ts";
import { POST as attach } from "../src/app/api/rewards/referral/route.ts";
import { POST as adminItem } from "../src/app/api/admin/store-items/route.ts";
import { POST as createRequest } from "../src/app/api/requests/route.ts";
import { POST as verify } from "../src/app/api/requests/[id]/verify/route.ts";
import { POST as startWave } from "../src/app/api/requests/[id]/outreach/route.ts";
import { POST as outcome } from "../src/app/api/invites/[id]/outcome/route.ts";

const db = getDb();
const BASE = "http://localhost:3000";
before(() => { process.env.FEATURE_TOKEN_REWARDS = "true"; });
after(async () => { delete process.env.FEATURE_TOKEN_REWARDS; await db.$disconnect(); });

const H = (t: string) => ({ authorization: `Bearer ${t}`, "content-type": "application/json" });
const post = (path: string, t: string, body: unknown, extra: Record<string, string> = {}) => new Request(`${BASE}${path}`, { method: "POST", headers: { ...H(t), ...extra }, body: JSON.stringify(body) });
const get = (path: string, t: string) => new Request(`${BASE}${path}`, { headers: H(t) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const deps: BotDeps = { core: createPrismaCoreApi(BASE), llm: null, appBaseUrl: BASE };
const say = (from: string, i: { text?: string; buttonId?: string; location?: { lat: number; lng: number } }) => processInbound(toInbound({ from, ...i }), deps);

async function newUser(id: string) { await db.user.create({ data: { id, name: `Test ${id}`, isSimulated: false } }); return (await createSession(id)).token; }
async function whatsappDonor(phone: string, firstText = "hi") {
  await recordReferral(phone, firstText);
  for (const m of [{ text: firstText }, { buttonId: BTN.LANG_EN }, { buttonId: BTN.TERMS_YES }, { buttonId: BTN.ROLE_DONATE }, { buttonId: BTN.YES }, { buttonId: BTN.YES }, { buttonId: BTN.YES }, { location: { lat: 18.523, lng: 73.853 } }, { text: "A-" }]) await say(phone, m);
  return db.user.findUniqueOrThrow({ where: { phone } });
}
const balance = async (userId: string) => (await db.wallet.findUnique({ where: { userId } }))?.balance ?? 0;

test("rewards are off unless FEATURE_TOKEN_REWARDS=true", async () => {
  const t = await newUser("rw-flag");
  process.env.FEATURE_TOKEN_REWARDS = "false";
  assert.equal((await wallet(get("/api/rewards", t))).status, 404);
  process.env.FEATURE_TOKEN_REWARDS = "true";
  const w = await (await wallet(get("/api/rewards", t))).json();
  assert.equal(w.balance, 0);
  assert.match(w.referral.code, /^[A-Z2-9]{8}$/);
  assert.equal(w.referral.link, `${process.env.APP_BASE_URL}/r/${w.referral.code}`);
});

test("referral via WhatsApp 'JOIN <code>' rewards the referrer when the friend registers as a donor — not for joining", async () => {
  const referrerToken = await newUser("rw-referrer");
  const code = await getOrCreateReferralCode("rw-referrer");
  const friend = await whatsappDonor("+919833300001", `JOIN ${code}`);
  const link = await db.referral.findUniqueOrThrow({ where: { referredUserId: friend.id } });
  assert.equal(link.referrerId, "rw-referrer");
  assert.ok(link.donorRewardedAt, "rewarded on donor registration");
  assert.equal(await balance("rw-referrer"), 25);
  const w = await (await wallet(get("/api/rewards", referrerToken))).json();
  assert.deepEqual([w.referral.joined, w.referral.becameDonors], [1, 1]);
  // Re-registering / repeating JOIN never pays twice.
  await recordReferral("+919833300001", `JOIN ${code}`);
  await say("+919833300001", { text: "A-" });
  assert.equal(await balance("rw-referrer"), 25);
});

test("referral abuse: self-referral, unknown code, second referrer and old accounts are rejected", async () => {
  const code = await getOrCreateReferralCode("rw-referrer");
  assert.equal((await attachReferral("rw-referrer", code)).reason, "self");
  await newUser("rw-x");
  assert.equal((await attachReferral("rw-x", "ZZZZZZZZ")).reason, "unknown_code");
  assert.equal((await attachReferral("rw-x", "bad")).reason, "invalid_code");
  assert.equal((await attachReferral("rw-x", code)).attached, true);
  await newUser("rw-other");
  assert.equal((await attachReferral("rw-x", await getOrCreateReferralCode("rw-other"))).reason, "already_referred");
  await db.user.create({ data: { id: "rw-old", name: "Old", createdAt: new Date(Date.now() - 3 * 86_400_000) } });
  assert.equal((await attachReferral("rw-old", code)).reason, "account_too_old");
  const t = (await createSession("rw-x")).token;
  assert.equal((await (await attach(post("/api/rewards/referral", t, { code: "zzzzzzzz" }))).json()).attached, false);
});

test("donor earns coins only when a blood centre confirms the donation; referrer gets the first-donation bonus once", async () => {
  const friend = await db.user.findUniqueOrThrow({ where: { phone: "+919833300001" } });
  const family = await createSession("demo-requester");
  const coord = await createSession("demo-coordinator");
  const res = await createRequest(post("/api/requests", family.token, { hospitalId: "demo-hospital-1", bloodGroup: "A-", component: "PLATELETS", units: 1, neededBy: new Date(Date.now() + 86_400_000).toISOString(), language: "en", confirmed: true }, { "idempotency-key": randomUUID() }));
  const id = (await res.json()).request.id;
  await verify(post(`/api/requests/${id}/verify`, coord.token, { decision: "VERIFIED", method: "Called hospital" }), p(id));
  await startWave(post(`/api/requests/${id}/outreach`, coord.token, {}), p(id));
  const invite = await db.outreachInvite.findFirstOrThrow({ where: { requestId: id, donorId: friend.id } });
  assert.equal((await respondToInvite("+919833300001", invite.id, "ACCEPT")).outcome, "ACCEPTED");
  assert.equal(await balance(friend.id), 0, "accepting is not rewarded");
  const done = await (await outcome(post(`/api/invites/${invite.id}/outcome`, coord.token, { outcome: "DONATED" }), p(invite.id))).json();
  assert.equal(done.coins, 100);
  assert.equal(await balance(friend.id), 100);
  assert.equal(await balance("rw-referrer"), 75, "25 registration + 50 first donation");
  const msg = await db.notification.findFirstOrThrow({ where: { userId: friend.id, purpose: "RECOGNITION" } });
  assert.match(JSON.parse(msg.payload).text, /earned 100 RaktDoot coins/);
});

test("store: redeem a sponsor coupon atomically; insufficient coins, limits and replays behave", async () => {
  const friend = await db.user.findUniqueOrThrow({ where: { phone: "+919833300001" } });
  const t = (await createSession(friend.id)).token;
  const items = (await (await store(get("/api/rewards/store", t))).json()).items as Array<{ id: string; costCoins: number; remaining: number }>;
  assert.ok(items.length >= 3);
  const coffee = items.find((i) => i.id === "demo-item-coffee")!;
  const movie = items.find((i) => i.id === "demo-item-movie")!;
  assert.equal((await redeem(post("/api/rewards/redeem", t, { itemId: movie.id }, { "idempotency-key": randomUUID() }))).status, 409, "250 > 100 coins");
  const key = randomUUID();
  const r1 = await redeem(post("/api/rewards/redeem", t, { itemId: coffee.id }, { "idempotency-key": key }));
  assert.equal(r1.status, 201);
  const body = await r1.json();
  assert.match(body.code, /^DEMO-CAFE-\d{4}$/);
  assert.equal(body.balance, 50);
  const replay = await redeem(post("/api/rewards/redeem", t, { itemId: coffee.id }, { "idempotency-key": key }));
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).code, body.code, "same code on replay, no double charge");
  assert.equal(await balance(friend.id), 50);
  assert.equal((await redeem(post("/api/rewards/redeem", t, { itemId: coffee.id }, { "idempotency-key": randomUUID() }))).status, 409, "per-user limit 1");
  const ledger = await db.coinEntry.findMany({ where: { userId: friend.id } });
  assert.equal(ledger.reduce((s, e) => s + e.amount, 0), await balance(friend.id), "ledger sums to balance");
});

test("concurrent redemptions can never overspend or hand out the same code twice", async () => {
  const t = await newUser("rw-race");
  await db.wallet.create({ data: { userId: "rw-race", balance: 100 } });
  await db.coinEntry.create({ data: { userId: "rw-race", amount: 100, reason: "ADJUSTMENT", refKey: "test:rw-race" } });
  const tries = await Promise.allSettled(["demo-item-coffee", "demo-item-pharmacy", "demo-item-coffee"].map((itemId) => redeem(post("/api/rewards/redeem", t, { itemId }, { "idempotency-key": randomUUID() }))));
  const ok = tries.filter((r) => r.status === "fulfilled" && r.value.status === 201).length;
  assert.ok(ok >= 1 && ok <= 2);
  assert.ok(await balance("rw-race") >= 0, "never negative");
  const codes = await db.couponCode.findMany({ where: { redeemedById: { not: null } } });
  assert.equal(new Set(codes.map((c) => c.code)).size, codes.length, "every issued code is unique");
});

test("only admins can add sponsor rewards; codes are validated", async () => {
  const coord = await createSession("demo-coordinator");
  const body = { sponsorName: "Test Sponsor", title: "Free juice", description: "One juice", costCoins: 40, couponCodes: ["JUICE-0001", "JUICE-0002"] };
  assert.equal((await adminItem(post("/api/admin/store-items", coord.token, body))).status, 403);
  await db.user.create({ data: { id: "rw-admin", name: "Admin", role: "ADMIN", verifiedAt: new Date() } });
  const admin = await createSession("rw-admin");
  assert.equal((await adminItem(post("/api/admin/store-items", admin.token, { ...body, couponCodes: ["bad code"] }))).status, 400);
  const ok = await adminItem(post("/api/admin/store-items", admin.token, body));
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).coupons, 2);
});

test("DELETE MY DATA also erases wallet, ledger and referral links", async () => {
  const u = await whatsappDonor("+919833300009");
  await db.wallet.create({ data: { userId: u.id, balance: 10 } });
  await getOrCreateReferralCode(u.id);
  await say("+919833300009", { text: "DELETE MY DATA" });
  assert.equal(await db.wallet.count({ where: { userId: u.id } }), 0);
  assert.equal(await db.referralCode.count({ where: { userId: u.id } }), 0);
});