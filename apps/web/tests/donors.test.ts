import { test, after } from "node:test";
import assert from "node:assert/strict";
import { CURRENT_TERMS_VERSION } from "@raktdoot/shared";
import { getDb } from "../src/server/db.ts";
import { createSession, SESSION_COOKIE } from "../src/server/auth/session.ts";
import { GET as getConsent, POST as postConsent } from "../src/app/api/consent/route.ts";
import { GET as getDonor, PUT as putDonor } from "../src/app/api/donors/route.ts";
import { PUT as putAvailability } from "../src/app/api/donors/availability/route.ts";
import { DELETE as deleteLocation, PUT as putLocation } from "../src/app/api/donors/location/route.ts";

const db = getDb();
after(async () => { await db.$disconnect(); });
const base = "http://localhost:3000";

async function newUser(id: string): Promise<string> {
  await db.user.create({ data: { id, name: "Fictional Test User", isSimulated: true } });
  return (await createSession(id)).token;
}
const send = (method: string, path: string, token: string, body?: unknown) => new Request(`${base}${path}`, {
  method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const consent = (token: string, updates: unknown[], termsVersion = CURRENT_TERMS_VERSION) => postConsent(send("POST", "/api/consent", token, { termsVersion, updates }));
const register = { bloodGroup: "O-", sex: "FEMALE", travelRadiusKm: 12, ageConfirmed: true };
const grantBasics = (token: string) => consent(token, [{ type: "TERMS", channel: null, granted: true }, { type: "LOCATION_STORAGE", channel: null, granted: true }, { type: "URGENT_ALERTS", channel: "APP_PUSH", granted: true }]);

test("donor endpoints require a session", async () => {
  assert.equal((await getDonor(new Request(`${base}/api/donors`))).status, 401);
  assert.equal((await getConsent(new Request(`${base}/api/consent`))).status, 401);
});

test("registration requires terms; new donors start PAUSED", async () => {
  const token = await newUser("t-register");
  assert.equal((await putDonor(send("PUT", "/api/donors", token, register))).status, 409);
  assert.equal((await consent(token, [{ type: "URGENT_ALERTS", channel: "WHATSAPP", granted: true }])).status, 409);
  assert.equal((await consent(token, [{ type: "TERMS", channel: null, granted: true }], "old-version")).status, 409);
  assert.equal((await grantBasics(token)).status, 200);
  const created = await putDonor(send("PUT", "/api/donors", token, register));
  assert.equal(created.status, 201);
  const { profile } = await created.json();
  assert.equal(profile.availability, "PAUSED");
  assert.equal(profile.location, null);
  assert.equal((await putDonor(send("PUT", "/api/donors", token, { ...register, travelRadiusKm: 20 }))).status, 200);
  assert.equal((await putDonor(send("PUT", "/api/donors", token, { ...register, ageConfirmed: false }))).status, 400);
});

test("consent records are append-only, idempotent for unchanged values, and server-sourced", async () => {
  const token = await newUser("t-consent");
  await grantBasics(token);
  const before = await db.consent.count({ where: { userId: "t-consent" } });
  await grantBasics(token);
  assert.equal(await db.consent.count({ where: { userId: "t-consent" } }), before);
  await consent(token, [{ type: "URGENT_ALERTS", channel: "APP_PUSH", granted: false }]);
  const rows = await db.consent.findMany({ where: { userId: "t-consent" } });
  assert.equal(rows.length, before + 1);
  assert.ok(rows.every((row) => row.source === "APP" && row.termsVersion === CURRENT_TERMS_VERSION));
  const state = await (await getConsent(send("GET", "/api/consent", token))).json();
  assert.equal(state.consents.find((c: { type: string }) => c.type === "URGENT_ALERTS").granted, false);
  assert.equal((await consent(token, [{ type: "CONTACT_SHARING", channel: null, granted: true }])).status, 400);
});

test("location requires consent, is coarsened, rejects WhatsApp source, and is deleted on withdrawal", async () => {
  const token = await newUser("t-location");
  await consent(token, [{ type: "TERMS", channel: null, granted: true }]);
  await putDonor(send("PUT", "/api/donors", token, register));
  const pin = { lat: 18.520437, lng: 73.856743, source: "APP_GPS", areaLabel: "Shivajinagar" };
  assert.equal((await putLocation(send("PUT", "/api/donors/location", token, pin))).status, 403);
  await consent(token, [{ type: "LOCATION_STORAGE", channel: null, granted: true }]);
  assert.equal((await putLocation(send("PUT", "/api/donors/location", token, { ...pin, source: "WHATSAPP_SHARE" }))).status, 400);
  const saved = await putLocation(send("PUT", "/api/donors/location", token, pin));
  assert.equal(saved.status, 200);
  const stored = await db.donorLocation.findUniqueOrThrow({ where: { userId: "t-location" } });
  assert.deepEqual([stored.lat, stored.lng], [18.52, 73.86]);
  assert.equal((await saved.json()).profile.location.needsUpdate, false);
  await consent(token, [{ type: "LOCATION_STORAGE", channel: null, granted: false }]);
  assert.equal(await db.donorLocation.count({ where: { userId: "t-location" } }), 0);
  await consent(token, [{ type: "LOCATION_STORAGE", channel: null, granted: true }]);
  await putLocation(send("PUT", "/api/donors/location", token, pin));
  assert.deepEqual(await (await deleteLocation(send("DELETE", "/api/donors/location", token))).json(), { deleted: true });
  assert.deepEqual(await (await deleteLocation(send("DELETE", "/api/donors/location", token))).json(), { deleted: false });
});

test("withdrawing terms withdraws all purposes, removes location and pauses the donor", async () => {
  const token = await newUser("t-withdraw");
  await grantBasics(token);
  await putDonor(send("PUT", "/api/donors", token, register));
  await putAvailability(send("PUT", "/api/donors/availability", token, { availability: "AVAILABLE" }));
  await putLocation(send("PUT", "/api/donors/location", token, { lat: 18.53, lng: 73.84, source: "MANUAL_ENTRY" }));
  assert.equal((await consent(token, [{ type: "TERMS", channel: null, granted: false }])).status, 200);
  const state = await (await getConsent(send("GET", "/api/consent", token))).json();
  assert.ok(state.consents.every((c: { granted: boolean }) => c.granted === false));
  assert.equal(await db.donorLocation.count({ where: { userId: "t-withdraw" } }), 0);
  const { profile } = await (await getDonor(send("GET", "/api/donors", token))).json();
  assert.equal(profile.availability, "PAUSED");
  assert.equal((await putAvailability(send("PUT", "/api/donors/availability", token, { availability: "AVAILABLE" }))).status, 409);
});

test("availability toggles validate dates and expose effective state", async () => {
  const token = await newUser("t-availability");
  assert.equal((await putAvailability(send("PUT", "/api/donors/availability", token, { availability: "AVAILABLE" }))).status, 404);
  await consent(token, [{ type: "TERMS", channel: null, granted: true }]);
  await putDonor(send("PUT", "/api/donors", token, register));
  const until = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const away = await (await putAvailability(send("PUT", "/api/donors/availability", token, { availability: "UNAVAILABLE", unavailableUntil: until }))).json();
  assert.equal(away.profile.effectiveAvailability, "UNAVAILABLE");
  await db.donorProfile.update({ where: { userId: "t-availability" }, data: { unavailableUntil: new Date(Date.now() - 1000) } });
  const { profile } = await (await getDonor(send("GET", "/api/donors", token))).json();
  assert.equal(profile.effectiveAvailability, "PAUSED");
  assert.equal((await putAvailability(send("PUT", "/api/donors/availability", token, { availability: "UNAVAILABLE" }))).status, 400);
});

test("self-reported donation dates only move forward and yield a provisional review date", async () => {
  const token = await newUser("t-history");
  await consent(token, [{ type: "TERMS", channel: null, granted: true }]);
  const recent = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const older = new Date(Date.now() - 200 * 86_400_000).toISOString();
  await putDonor(send("PUT", "/api/donors", token, { ...register, sex: "MALE", lastDonationAt: recent }));
  const { profile } = await (await putDonor(send("PUT", "/api/donors", token, { ...register, sex: "MALE", lastDonationAt: older }))).json();
  assert.equal(profile.lastDonationAt, recent);
  assert.equal(profile.lastDonationSource, "SELF_REPORTED");
  assert.equal(profile.provisionalNextReviewAt, new Date(Date.parse(recent) + 90 * 86_400_000).toISOString());
});

test("users only see their own donor data; cookie mutations need same origin", async () => {
  const tokenA = await newUser("t-own-a");
  const tokenB = await newUser("t-own-b");
  await consent(tokenA, [{ type: "TERMS", channel: null, granted: true }]);
  await putDonor(send("PUT", "/api/donors", tokenA, register));
  assert.equal((await getDonor(send("GET", "/api/donors", tokenB))).status, 404);
  const crossSite = new Request(`${base}/api/consent`, { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${tokenB}`, origin: "https://untrusted.example", "content-type": "application/json" }, body: JSON.stringify({ termsVersion: CURRENT_TERMS_VERSION, updates: [{ type: "TERMS", channel: null, granted: true }] }) });
  assert.equal((await postConsent(crossSite)).status, 403);
});