// End-to-end backend test of the demo story, against real route handlers and the DB:
// donors sign up on WhatsApp (bot → Prisma adapter) → family requests → staff verify →
// wave invites nearby consented donors on WhatsApp → donor taps Accept → slot claimed,
// stand-down → donation confirmed → units issued → closed FULFILLED.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { processInbound, BTN, toInbound, type BotDeps } from "@raktdoot/bot";
import { getDb } from "../src/server/db.ts";
import { createSession } from "../src/server/auth/session.ts";
import { createPrismaCoreApi, resolveHospital } from "../src/server/bot/core-adapter.ts";
import { dispatchPending } from "../src/server/notifications/outbox.ts";
import { respondToInvite, expireWaves } from "../src/server/outreach/service.ts";
import { queueDueReminders } from "../src/server/reminders/service.ts";
import { POST as createRequest } from "../src/app/api/requests/route.ts";
import { POST as verify } from "../src/app/api/requests/[id]/verify/route.ts";
import { GET as matches } from "../src/app/api/requests/[id]/matches/route.ts";
import { GET as outreachGet, POST as startWave } from "../src/app/api/requests/[id]/outreach/route.ts";
import { POST as fulfil } from "../src/app/api/requests/[id]/fulfilment/route.ts";
import { POST as close } from "../src/app/api/requests/[id]/close/route.ts";
import { POST as outcome } from "../src/app/api/invites/[id]/outcome/route.ts";
import { GET as queue } from "../src/app/api/verification/route.ts";

const db = getDb();
after(async () => { await db.$disconnect(); });
const BASE = "http://localhost:3000";
const H = (token: string) => ({ authorization: `Bearer ${token}`, "content-type": "application/json" });
const post = (path: string, token: string, body: unknown) => new Request(`${BASE}${path}`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
const get = (path: string, token: string) => new Request(`${BASE}${path}`, { headers: H(token) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

const deps: BotDeps = { core: createPrismaCoreApi(BASE), llm: null, appBaseUrl: BASE };
const say = (from: string, input: { text?: string; buttonId?: string; location?: { lat: number; lng: number } }) => processInbound(toInbound({ from, ...input }), deps);

/** A real WhatsApp donor sign-up through M1's conversation flow and M2's adapter. */
async function whatsappDonor(phone: string, group: string, pin: { lat: number; lng: number }) {
  await say(phone, { text: "hi" });
  await say(phone, { buttonId: BTN.LANG_EN });
  await say(phone, { buttonId: BTN.TERMS_YES });
  await say(phone, { buttonId: BTN.ROLE_DONATE });
  await say(phone, { buttonId: BTN.YES }); // alerts
  await say(phone, { buttonId: BTN.YES }); // reminders
  await say(phone, { buttonId: BTN.YES }); // location storage
  await say(phone, { location: pin });
  await say(phone, { text: group });
  return db.user.findUniqueOrThrow({ where: { phone }, include: { donorProfile: { include: { location: true } } } });
}

async function newRequest(token: string, units = 1, group = "AB-") {
  const res = await createRequest(new Request(`${BASE}/api/requests`, { method: "POST", headers: { ...H(token), "idempotency-key": randomUUID() }, body: JSON.stringify({ hospitalId: "demo-hospital-1", bloodGroup: group, component: "PACKED_RED_CELLS", units, neededBy: new Date(Date.now() + 86_400_000).toISOString(), language: "en", confirmed: true }) }));
  assert.equal(res.status, 201);
  return (await res.json()).request as { id: string; verification: string };
}

test("WhatsApp donor sign-up persists consent, coarse location and AVAILABLE profile", async () => {
  const u = await whatsappDonor("+919811100001", "AB-", { lat: 18.52437, lng: 73.85211 });
  assert.equal(u.donorProfile?.bloodGroup, "AB-");
  assert.equal(u.donorProfile?.availability, "AVAILABLE");
  assert.deepEqual([u.donorProfile?.location?.lat, u.donorProfile?.location?.lng], [18.52, 73.85]);
  const consents = await db.consent.findMany({ where: { userId: u.id } });
  assert.ok(consents.every((c) => c.source === "WHATSAPP"));
  assert.ok(consents.some((c) => c.type === "URGENT_ALERTS" && c.channel === "WHATSAPP" && c.granted));
  const state = await db.botConversation.findUniqueOrThrow({ where: { phone: "+919811100001" } });
  assert.equal(JSON.parse(state.state).donorRegistered, true);
});

test("a donor who refuses location is never matched", async () => {
  const phone = "+919811100002";
  await say(phone, { text: "hi" }); await say(phone, { buttonId: BTN.LANG_EN }); await say(phone, { buttonId: BTN.TERMS_YES });
  await say(phone, { buttonId: BTN.ROLE_DONATE }); await say(phone, { buttonId: BTN.YES }); await say(phone, { buttonId: BTN.YES });
  await say(phone, { buttonId: BTN.NO }); // location refused
  await say(phone, { text: "AB-" });
  const u = await db.user.findUniqueOrThrow({ where: { phone }, include: { donorProfile: { include: { location: true } } } });
  assert.equal(u.donorProfile?.location, null);
});

test("full demo loop: verify → wave → WhatsApp invite → accept → stand-down → donate → fulfil → close", async () => {
  const donorA = await db.user.findUniqueOrThrow({ where: { phone: "+919811100001" } });
  const donorB = await whatsappDonor("+919811100003", "AB-", { lat: 18.5301, lng: 73.8602 });
  const family = await createSession("demo-requester");
  const coordinator = await createSession("demo-coordinator");
  const centre = await createSession("demo-centre-staff");
  const req = await newRequest(family.token, 1);
  assert.equal(req.verification, "PENDING_REVIEW");

  // Outreach is blocked before verification.
  assert.equal((await startWave(post(`/api/requests/${req.id}/outreach`, coordinator.token, {}), p(req.id))).status, 409);
  assert.ok((await (await queue(get("/api/verification", coordinator.token))).json()).queue.some((q: { id: string }) => q.id === req.id));
  assert.equal((await verify(post(`/api/requests/${req.id}/verify`, family.token, { decision: "VERIFIED", method: "self" }), p(req.id))).status, 403);
  assert.equal((await verify(post(`/api/requests/${req.id}/verify`, coordinator.token, { decision: "VERIFIED", method: "Called ward sister" }), p(req.id))).status, 200);

  // Explainable preview: both WhatsApp donors, the location-less one excluded.
  const preview = await (await matches(get(`/api/requests/${req.id}/matches`, coordinator.token), p(req.id))).json();
  const ids = preview.candidates.map((c: { donorId: string }) => c.donorId);
  assert.ok(ids.includes(donorA.id) && ids.includes(donorB.id));
  assert.ok(preview.candidates.every((c: { reasons: string[] }) => c.reasons.length === 3));
  assert.ok(!JSON.stringify(preview).includes("+9198"), "no phone numbers in staff previews");

  const wave = await startWave(post(`/api/requests/${req.id}/outreach`, coordinator.token, {}), p(req.id));
  assert.equal(wave.status, 201);
  const w = await wave.json();
  assert.equal(w.waveNumber, 1);
  assert.ok(w.invited >= 2);

  // WhatsApp invites with Accept / Ignore buttons; flushed as SIMULATED (no Meta creds in tests).
  const invites = await db.notification.findMany({ where: { requestId: req.id, purpose: "URGENT_ALERT" } });
  assert.ok(invites.length >= 2);
  const msg = JSON.parse(invites.find((n) => n.toPhone === "+919811100001")!.payload);
  assert.equal(msg.kind, "buttons");
  assert.deepEqual(msg.buttons.map((b: { title: string }) => b.title), ["Accept", "Ignore", "Pause alerts"]);
  assert.ok(invites.every((n) => n.status === "SIMULATED"), "flushed after commit");

  // Donor A taps Accept in WhatsApp → real bot → adapter → slot claimed.
  const inviteA = await db.outreachInvite.findFirstOrThrow({ where: { requestId: req.id, donorId: donorA.id } });
  const reply = await say("+919811100001", { buttonId: `invite:${inviteA.id}:accept` });
  assert.match(reply[0]!.text, /Thank you/);
  // Units = 1, so donor B's later accept is politely refused and B is stood down.
  const inviteB = await db.outreachInvite.findFirstOrThrow({ where: { requestId: req.id, donorId: donorB.id } });
  assert.equal((await respondToInvite("+919811100003", inviteB.id, "ACCEPT")).outcome, "ALREADY");
  assert.equal((await db.outreachInvite.findUniqueOrThrow({ where: { id: inviteB.id } })).status, "STOOD_DOWN");
  assert.equal((await db.bloodRequest.findUniqueOrThrow({ where: { id: req.id } })).acceptedCount, 1);
  assert.ok(await db.notification.findFirst({ where: { inviteId: inviteB.id, purpose: "STAND_DOWN" } }), "stand-down message queued");
  assert.ok(await db.consent.findFirst({ where: { userId: donorA.id, type: "CONTACT_SHARING", requestId: req.id, granted: true } }), "request-scoped contact consent");

  // Another phone cannot answer someone else's invite.
  assert.equal((await respondToInvite("+919811100003", inviteA.id, "DECLINE")).outcome, "NOT_FOUND");

  // Closed loop. Accepting is not fulfilment.
  assert.equal((await close(post(`/api/requests/${req.id}/close`, coordinator.token, { outcome: "FULFILLED" }), p(req.id))).status, 409);
  assert.equal((await outcome(post(`/api/invites/${inviteA.id}/outcome`, coordinator.token, { outcome: "ARRIVED" }), p(inviteA.id))).status, 200);
  const donated = await outcome(post(`/api/invites/${inviteA.id}/outcome`, coordinator.token, { outcome: "DONATED" }), p(inviteA.id));
  assert.equal(donated.status, 200);
  assert.match((await donated.json()).certificate, /^RD-/);
  assert.equal((await outcome(post(`/api/invites/${inviteA.id}/outcome`, coordinator.token, { outcome: "DONATED" }), p(inviteA.id))).status, 409, "no double award");
  assert.equal(await db.recognitionAward.count({ where: { inviteId: inviteA.id } }), 1);
  assert.equal((await db.donorProfile.findUniqueOrThrow({ where: { userId: donorA.id } })).lastDonationSource, "CENTRE_CONFIRMED");

  // Centre staff have no case scope here; coordinator records issued units.
  assert.equal((await fulfil(post(`/api/requests/${req.id}/fulfilment`, centre.token, { units: 1, source: "DONOR_DONATION" }), p(req.id))).status, 404);
  assert.equal((await fulfil(post(`/api/requests/${req.id}/fulfilment`, coordinator.token, { units: 1, source: "DONOR_DONATION" }), p(req.id))).status, 201);
  const closed = await close(post(`/api/requests/${req.id}/close`, coordinator.token, { outcome: "FULFILLED" }), p(req.id));
  assert.equal(closed.status, 200);
  const timeline = await db.requestEvent.findMany({ where: { requestId: req.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  assert.deepEqual(timeline.map((e) => e.kind), ["STATUS_CHANGED", "REQUEST_VERIFIED", "WAVE_STARTED", "DONOR_ACCEPTED", "DONOR_ARRIVED", "DONATION_CONFIRMED", "UNITS_ISSUED", "REQUEST_CLOSED"]);
  const summary = await (await outreachGet(get(`/api/requests/${req.id}/outreach`, coordinator.token), p(req.id))).json();
  assert.equal(summary.status, "CLOSED");
  assert.equal(summary.issuedUnits, 1);
});

test("concurrent accepts never over-commit a request", async () => {
  const donors = await Promise.all(["+919811100011", "+919811100012", "+919811100013"].map((ph, i) => whatsappDonor(ph, "AB-", { lat: 18.521 + i * 0.002, lng: 73.851 })));
  const family = await createSession("demo-requester");
  const coordinator = await createSession("demo-coordinator");
  const req = await newRequest(family.token, 1);
  await verify(post(`/api/requests/${req.id}/verify`, coordinator.token, { decision: "VERIFIED", method: "Called hospital" }), p(req.id));
  await startWave(post(`/api/requests/${req.id}/outreach`, coordinator.token, {}), p(req.id));
  const invites = await db.outreachInvite.findMany({ where: { requestId: req.id, donorId: { in: donors.map((d) => d.id) } }, include: { donor: true } });
  assert.equal(invites.length, 3);
  const results = await Promise.allSettled(invites.map((i) => respondToInvite(i.donor.phone!, i.id, "ACCEPT")));
  const accepted = results.filter((r) => r.status === "fulfilled" && r.value.outcome === "ACCEPTED").length;
  assert.equal(accepted, 1);
  assert.equal((await db.bloodRequest.findUniqueOrThrow({ where: { id: req.id } })).acceptedCount, 1);
});

test("STOP withdraws alert consent so the donor is excluded from the next wave", async () => {
  const d = await whatsappDonor("+919811100021", "AB-", { lat: 18.522, lng: 73.852 });
  await say("+919811100021", { text: "STOP" });
  const family = await createSession("demo-requester");
  const coordinator = await createSession("demo-coordinator");
  const req = await newRequest(family.token, 1);
  await verify(post(`/api/requests/${req.id}/verify`, coordinator.token, { decision: "VERIFIED", method: "Called hospital" }), p(req.id));
  const preview = await (await matches(get(`/api/requests/${req.id}/matches`, coordinator.token), p(req.id))).json();
  assert.ok(!preview.candidates.some((c: { donorId: string }) => c.donorId === d.id));
});

test("rejected requests close and never reach donors; requester can cancel own request", async () => {
  const family = await createSession("demo-requester");
  const coordinator = await createSession("demo-coordinator");
  const bad = await newRequest(family.token);
  assert.equal((await verify(post(`/api/requests/${bad.id}/verify`, coordinator.token, { decision: "REJECTED", method: "Hospital has no such patient" }), p(bad.id))).status, 200);
  assert.equal((await startWave(post(`/api/requests/${bad.id}/outreach`, coordinator.token, {}), p(bad.id))).status, 409);
  const mine = await newRequest(family.token);
  assert.equal((await close(post(`/api/requests/${mine.id}/close`, family.token, { outcome: "FULFILLED" }), p(mine.id))).status, 403);
  assert.equal((await close(post(`/api/requests/${mine.id}/close`, family.token, { outcome: "CANCELLED" }), p(mine.id))).status, 200);
});

test("waves expire, outbox retries, fictional donors are never really messaged", async () => {
  await db.outreachWave.updateMany({ where: { closedAt: null }, data: { closesAt: new Date(Date.now() - 1000) } });
  assert.ok(await expireWaves() >= 0);
  const failing = async () => ({ ok: false, error: "HTTP 500" });
  const real = await db.user.findUniqueOrThrow({ where: { phone: "+919811100001" } });
  await db.notification.create({ data: { userId: real.id, toPhone: "+919811100001", channel: "WHATSAPP", purpose: "STATUS_UPDATE", payload: JSON.stringify({ to: "+919811100001", kind: "text", text: "x" }), dedupeKey: `t:${randomUUID()}` } });
  for (let i = 0; i < 3; i++) await dispatchPending(failing);
  assert.ok(await db.notification.findFirst({ where: { toPhone: "+919811100001", status: "FAILED", attempts: 3 } }));
  const fake = await db.user.findUniqueOrThrow({ where: { id: "demo-donor-2" } });
  await db.user.update({ where: { id: fake.id }, data: { phone: "+919999900002" } });
  const n = await db.notification.create({ data: { userId: fake.id, toPhone: "+919999900002", channel: "WHATSAPP", purpose: "STATUS_UPDATE", payload: JSON.stringify({ to: "+919999900002", kind: "text", text: "x" }), dedupeKey: `t:${randomUUID()}` } });
  let called = 0;
  await dispatchPending(async () => { called++; return { ok: true }; });
  assert.equal(called, 0, "isSimulated recipients are never sent to the provider");
  assert.equal((await db.notification.findUniqueOrThrow({ where: { id: n.id } })).status, "SIMULATED");
});

test("reminders: consented donors past the interval get exactly one 'may be eligible' reminder", async () => {
  const u = await db.user.findUniqueOrThrow({ where: { phone: "+919811100003" } });
  await db.donorProfile.update({ where: { userId: u.id }, data: { lastDonationAt: new Date(Date.now() - 200 * 86_400_000) } });
  assert.ok(await queueDueReminders() >= 1);
  await queueDueReminders();
  const rows = await db.notification.findMany({ where: { userId: u.id, purpose: "REMINDER" } });
  assert.equal(rows.length, 1);
  assert.match(JSON.parse(rows[0]!.payload).text, /may be eligible/);
});

test("hospital names typed in WhatsApp resolve to the directory; unknown names do not create requests", async () => {
  assert.equal((await resolveHospital("Demo Hospital 1"))?.id, "demo-hospital-1");
  assert.equal(await resolveHospital("Nowhere Clinic"), null);
});

test("DELETE MY DATA removes identity, consent, location and sessions", async () => {
  const phone = "+919811100031";
  const u = await whatsappDonor(phone, "AB-", { lat: 18.52, lng: 73.85 });
  await say(phone, { text: "DELETE MY DATA" });
  const after = await db.user.findUniqueOrThrow({ where: { id: u.id }, include: { donorProfile: true, consents: true } });
  assert.equal(after.phone, null);
  assert.equal(after.donorProfile, null);
  assert.equal(after.consents.length, 0);
  assert.equal(await db.botConversation.count({ where: { phone } }), 0);
});