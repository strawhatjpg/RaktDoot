// Owner: M3. Integration tests for forecast + Copilot routes against M2's sessions and DB.
// The forecast service and LLM are not called: only auth, scoping and the approval gate.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ActorContext } from "@raktdoot/shared";
import { getDb } from "../src/server/db.ts";
import { createSession } from "../src/server/auth/session.ts";
import { createDbDataSource } from "../src/server/copilot/data-source.ts";
import { approvalsFor } from "../src/server/copilot/index.ts";
import { POST as createRequest } from "../src/app/api/requests/route.ts";
import { POST as forecast } from "../src/app/api/forecast/route.ts";
import { POST as ask } from "../src/app/api/copilot/route.ts";
import { GET as listDrafts } from "../src/app/api/copilot/drafts/route.ts";
import { POST as decide } from "../src/app/api/copilot/drafts/[id]/route.ts";

const db = getDb();
after(async () => { await db.$disconnect(); });

const BASE = "http://localhost:3000";
const auth = (token: string) => ({ authorization: `Bearer ${token}`, "content-type": "application/json" });
const post = (path: string, headers: Record<string, string>, body: unknown) =>
  new Request(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });

async function actorFor(userId: string): Promise<ActorContext> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return { userId: user.id, role: user.role, verified: user.verifiedAt !== null, hospitalId: user.hospitalId, district: user.district };
}

async function newRequest(token: string, hospitalId = "demo-hospital-1") {
  const body = { hospitalId, bloodGroup: "O+", component: "PLATELETS", units: 2, neededBy: new Date(Date.now() + 86_400_000).toISOString(), language: "en", confirmed: true };
  const res = await createRequest(post("/api/requests", { ...auth(token), "idempotency-key": randomUUID() }, body));
  return (await res.json()).request as { id: string; verification: string };
}

const draftFor = (requestId: string) => ({
  kind: "DONOR_OUTREACH" as const, requestId, district: null, bloodGroup: "O+" as const, component: "PLATELETS" as const,
  audience: "wave 1", message: "m", rationale: "test",
});

test("copilot and forecast routes require verified staff", async () => {
  const requester = await createSession("demo-requester");
  assert.equal((await ask(post("/api/copilot", { "content-type": "application/json" }, { question: "hi" }))).status, 401);
  assert.equal((await ask(post("/api/copilot", auth(requester.token), { question: "hi" }))).status, 403);
  assert.equal((await forecast(post("/api/forecast", auth(requester.token), { district: "Pune", horizonWeeks: 1 }))).status, 403);
});

test("invalid input is rejected before any AI or forecast call", async () => {
  const coordinator = await createSession("demo-coordinator");
  assert.equal((await ask(post("/api/copilot", auth(coordinator.token), { question: "  " }))).status, 400);
  assert.equal((await forecast(post("/api/forecast", auth(coordinator.token), { district: "Pune", horizonWeeks: 9 }))).status, 400);

test("DB data source is scoped by M2's access rules", async () => {
  const requester = await createSession("demo-requester");
  const pune = await newRequest(requester.token, "demo-hospital-1");
  const mumbai = await newRequest(requester.token, "demo-hospital-2");

  const puneCoordinator = createDbDataSource(await actorFor("demo-coordinator"));
  const open = (await puneCoordinator.getOpenRequests()).map((r) => r.id);
  assert.ok(open.includes(pune.id));
  assert.equal(open.includes(mumbai.id), false); // other district
  assert.equal(await puneCoordinator.getRequest(mumbai.id), null);

  const centres = await puneCoordinator.searchCentres(pune.id);
  assert.ok(centres.length > 0);
  assert.ok(centres.every((c) => c.isSimulated));
  assert.equal((await puneCoordinator.getCaseEvents(pune.id))[0]?.summary, "NEW → OPEN");
  assert.deepEqual(await puneCoordinator.rankDonors(pune.id, 5), []); // matching not built yet

  const centreStaff = createDbDataSource(await actorFor("demo-centre-staff"));
  assert.deepEqual(await centreStaff.getOpenRequests(), []); // no case assignments yet
});

test("drafts: unverified requests are blocked; only coordinators approve via the route", async () => {
  const requester = await createSession("demo-requester");
  const coordinator = await createSession("demo-coordinator");
  const hospitalStaff = await createSession("demo-hospital-staff");
  const approvals = approvalsFor(await actorFor("demo-coordinator"));

  const pending = await newRequest(requester.token); // family-raised → PENDING_REVIEW
  assert.equal(pending.verification, "PENDING_REVIEW");
  assert.equal((await approvals.createDraft(draftFor(pending.id))).ok, false);

  const verified = await newRequest(hospitalStaff.token); // staff-raised → VERIFIED
  assert.equal(verified.verification, "VERIFIED");
  const made = await approvals.createDraft(draftFor(verified.id));
  assert.ok(made.ok);
  const id = made.draft.id;
  const call = (token: string, body: unknown) =>
    decide(post(`/api/copilot/drafts/${id}`, auth(token), body), { params: Promise.resolve({ id }) });

  assert.equal((await call(hospitalStaff.token, { action: "approve" })).status, 403);
  assert.equal((await call(coordinator.token, { action: "nope" })).status, 400);
  const approved = await call(coordinator.token, { action: "approve", note: "ok" });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).draft.status, "APPROVED");
  assert.equal((await call(coordinator.token, { action: "approve" })).status, 409); // no double send

  const list = await listDrafts(new Request(`${BASE}/api/copilot/drafts?status=APPROVED`, { headers: auth(coordinator.token) }));
  assert.ok((await list.json()).drafts.some((d: { id: string }) => d.id === id));
});

});
