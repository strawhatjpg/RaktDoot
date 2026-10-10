import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../src/server/db.ts";
import { createSession, SESSION_COOKIE } from "../src/server/auth/session.ts";
import { POST, GET as list } from "../src/app/api/requests/route.ts";
import { GET as detail } from "../src/app/api/requests/[id]/route.ts";
import { GET as centres } from "../src/app/api/centres/route.ts";

const db = getDb();
after(async () => { await db.$disconnect(); });
const payload = () => ({ hospitalId: "demo-hospital-1", bloodGroup: "B+", component: "PACKED_RED_CELLS", units: 2, neededBy: new Date(Date.now() + 86_400_000).toISOString(), language: "hi-Latn", confirmed: true });
function post(token: string, body: unknown, key = randomUUID()) {
  return POST(new Request("http://localhost:3000/api/requests", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) }));
}
function read(token: string, id: string) {
  return detail(new Request(`http://localhost:3000/api/requests/${id}`, { headers: { authorization: `Bearer ${token}` } }), { params: Promise.resolve({ id }) });
}

test("seed is repeatable and contains no routable donor phones", async () => {
  assert.equal(await db.bloodCentre.count(), 15);
  assert.equal(await db.donorProfile.count(), 40);
  assert.equal(await db.stockSnapshot.count(), 30);
  assert.equal(await db.user.count({ where: { phone: { not: null } } }), 0);
  assert.equal(await db.consent.count(), 120);
});

test("unauthenticated callers and forged identity headers are denied", async () => {
  const response = await list(new Request("http://localhost:3000/api/requests", { headers: { "x-user-id": "demo-coordinator", "x-role": "ADMIN" } }));
  assert.equal(response.status, 401);
});

test("confirmed request creation is transactional and replay-safe", async () => {
  const { token } = await createSession("demo-requester");
  const key = randomUUID();
  const body = payload();
  const created = await post(token, body, key);
  assert.equal(created.status, 201);
  const data = await created.json();
  assert.equal(data.request.status, "OPEN");
  assert.equal(data.request.verification, "PENDING_REVIEW");
  const replay = await post(token, body, key);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).request.id, data.request.id);
  assert.equal((await post(token, { ...body, units: 3 }, key)).status, 409);
  assert.equal(await db.requestEvent.count({ where: { requestId: data.request.id } }), 1);
  assert.equal(await db.auditLog.count({ where: { entityId: data.request.id } }), 1);
  const result = await read(token, data.request.id);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).events.length, 1);
});

test("private requests enforce owner and staff scope", async () => {
  const requester = await createSession("demo-requester");
  const other = await createSession("demo-other-requester");
  const coordinator = await createSession("demo-coordinator");
  const created = await (await post(requester.token, payload())).json();
  assert.equal((await read(other.token, created.request.id)).status, 404);
  assert.equal((await read(coordinator.token, created.request.id)).status, 200);
  const mumbai = await (await post(requester.token, { ...payload(), hospitalId: "demo-hospital-2" })).json();
  assert.equal((await read(coordinator.token, mumbai.request.id)).status, 404);
  const otherList = await list(new Request("http://localhost:3000/api/requests", { headers: { authorization: `Bearer ${other.token}` } }));
  assert.deepEqual((await otherList.json()).requests, []);
});

test("simultaneous duplicate confirmations create one logical request", async () => {
  const { token } = await createSession("demo-requester");
  const body = payload();
  const key = randomUUID();
  const responses = await Promise.all([post(token, body, key), post(token, body, key)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  const values = await Promise.all(responses.map((response) => response.json()));
  assert.equal(values[0].request.id, values[1].request.id);
  assert.equal(await db.bloodRequest.count({ where: { idempotencyKey: key } }), 1);
});

test("staff-raised verification is limited to staff's actual scope", async () => {
  const { token } = await createSession("demo-hospital-staff");
  assert.equal((await (await post(token, payload())).json()).request.verification, "VERIFIED");
  assert.equal((await (await post(token, { ...payload(), hospitalId: "demo-hospital-2" })).json()).request.verification, "PENDING_REVIEW");
});

test("invalid bodies cannot spoof identity, status or verification", async () => {
  const { token } = await createSession("demo-requester");
  const count = await db.bloodRequest.count();
  for (const extra of [{ confirmed: false }, { role: "ADMIN" }, { verification: "VERIFIED" }, { units: -1 }, { hospitalId: "missing-hospital" }]) {
    assert.equal((await post(token, { ...payload(), ...extra })).status, 400);
  }
  assert.equal(await db.bloodRequest.count(), count);
});

test("expired sessions and cross-origin cookie mutations are denied", async () => {
  const { token } = await createSession("demo-other-requester");
  const request = (origin: string) => new Request("http://localhost:3000/api/requests", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${token}`, origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify(payload()) });
  assert.equal((await POST(request("https://untrusted.example"))).status, 403);
  assert.equal((await POST(request("http://localhost:3000"))).status, 201);
  await db.session.updateMany({ where: { userId: "demo-other-requester" }, data: { expiresAt: new Date(0) } });
  assert.equal((await post(token, payload())).status, 401);
});

test("public discovery labels fictional data and returns distances and stock age", async () => {
  const hospitals = await centres(new Request("http://localhost:3000/api/centres"));
  assert.equal((await hospitals.json()).hospitals.length, 2);
  const response = await centres(new Request("http://localhost:3000/api/centres?hospitalId=demo-hospital-1&bloodGroup=B%2B&component=PACKED_RED_CELLS"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.distanceKind, "STRAIGHT_LINE");
  assert.equal(data.centres.length, 15);
  for (const centre of data.centres) {
    assert.equal(centre.isSimulated, true);
    assert.equal(centre.stock.isSimulated, true);
    assert.equal(centre.stock.status, "REPORTED");
    assert.ok(Number.isFinite(Date.parse(centre.stock.updatedAt)));
    assert.equal(centre.phone, "");
  }
  assert.equal((await centres(new Request("http://localhost:3000/api/centres?component=UNKNOWN"))).status, 400);
});

test("malformed and oversized JSON are rejected", async () => {
  const { token } = await createSession("demo-requester");
  for (const [body, expected] of [["{", 400], ["x".repeat(20_000), 413]] as const) {
    const result = await POST(new Request("http://localhost:3000/api/requests", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": randomUUID() }, body }));
    assert.equal(result.status, expected);
  }
});

test("unrecognized authorization headers cannot bypass cookie origin checks", async () => {
  const { token } = await createSession("demo-requester");
  const response = await POST(new Request("http://localhost:3000/api/requests", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE}=${token}`, authorization: "Basic ignored", origin: "https://untrusted.example", "content-type": "application/json", "idempotency-key": randomUUID() },
    body: JSON.stringify(payload()),
  }));
  assert.equal(response.status, 401);
});