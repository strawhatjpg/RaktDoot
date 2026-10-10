import { test } from "node:test";
import assert from "node:assert/strict";
import { ApprovalStore, type CopilotDraft, type NewDraft } from "../src/approval.ts";
import { createMockDataSource } from "../src/mock-data.ts";

const outreach = (requestId: string): NewDraft => ({
  kind: "DONOR_OUTREACH",
  requestId,
  district: null,
  bloodGroup: "O+",
  component: "PLATELETS",
  audience: "wave 1",
  message: "msg",
  rationale: "test",
});

function store(onApproved?: (d: CopilotDraft) => void) {
  let n = 0;
  return new ApprovalStore({ data: createMockDataSource(), onApproved, newId: () => `D${++n}` });
}

test("drafts start pending and nothing is dispatched on creation", async () => {
  const sent: CopilotDraft[] = [];
  const s = store((d) => sent.push(d));
  const result = await s.createDraft(outreach("REQ-1001"));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.draft.status, "PENDING_APPROVAL");
  assert.equal(sent.length, 0);
});

test("donor outreach is refused for unverified, closed or unknown requests", async () => {
  const s = store();
  for (const id of ["REQ-1002", "REQ-0990", "REQ-404"]) {
    const result = await s.createDraft(outreach(id));
    assert.equal(result.ok, false, id);
  }
  const unverified = await s.createDraft(outreach("REQ-1002"));
  assert.match(!unverified.ok ? unverified.reason : "", /verified requests/);
});

test("only coordinators or admins can approve, and approval dispatches exactly once", async () => {
  const sent: CopilotDraft[] = [];
  const s = store((d) => sent.push(d));
  const created = await s.createDraft(outreach("REQ-1001"));
  assert.ok(created.ok);
  const id = created.draft.id;

  for (const role of ["REQUESTER", "DONOR", "HOSPITAL_STAFF", "BLOOD_CENTRE_STAFF"] as const) {
    assert.equal((await s.approve(id, role)).ok, false, role);
  }
  assert.equal(sent.length, 0);

  const approved = await s.approve(id, "COORDINATOR", " looks good ");
  assert.ok(approved.ok);
  assert.equal(approved.draft.status, "APPROVED");
  assert.equal(approved.draft.decisionNote, "looks good");
  assert.equal(sent.length, 1);

  assert.equal((await s.approve(id, "ADMIN")).ok, false); // no double send
  assert.equal(sent.length, 1);
});

test("rejected drafts cannot be approved or edited", async () => {
  const s = store();
  const created = await s.createDraft(outreach("REQ-1001"));
  assert.ok(created.ok);
  assert.equal(s.reject(created.draft.id, "COORDINATOR", "not now").ok, true);
  assert.equal((await s.approve(created.draft.id, "COORDINATOR")).ok, false);
  assert.equal(s.editMessage(created.draft.id, "new", "COORDINATOR").ok, false);
});

test("coordinator can edit a pending message; blank or non-staff edits are refused", async () => {
  const s = store();
  const created = await s.createDraft(outreach("REQ-1001"));
  assert.ok(created.ok);
  assert.equal(s.editMessage(created.draft.id, "  ", "COORDINATOR").ok, false);
  assert.equal(s.editMessage(created.draft.id, "edited", "DONOR").ok, false);
  const edited = s.editMessage(created.draft.id, " edited text ", "COORDINATOR");
  assert.ok(edited.ok);
  assert.equal(s.get(created.draft.id)?.message, "edited text");
});

test("safety is re-checked at approval time", async () => {
  const data = createMockDataSource();
  let verification: "VERIFIED" | "REJECTED" = "VERIFIED";
  const changing = { ...data, getRequest: async (id: string) => {
    const r = await data.getRequest(id);
    return r ? { ...r, verification } : null;
  } };
  const s = new ApprovalStore({ data: changing });
  const created = await s.createDraft(outreach("REQ-1001"));
  assert.ok(created.ok);
  verification = "REJECTED";
  assert.equal((await s.approve(created.draft.id, "COORDINATOR")).ok, false);
});

test("scoped views share drafts but re-check safety with their own data", async () => {
  const s = store();
  const created = await s.createDraft(outreach("REQ-1001"));
  assert.ok(created.ok);
  const blind = { ...createMockDataSource(), getRequest: async () => null }; // e.g. staff without access
  const view = s.scoped(blind);
  assert.equal(view.get(created.draft.id)?.id, created.draft.id);
  assert.equal((await view.approve(created.draft.id, "COORDINATOR")).ok, false);
  assert.equal((await s.scoped(createMockDataSource()).approve(created.draft.id, "COORDINATOR")).ok, true);
  assert.equal(s.get(created.draft.id)?.status, "APPROVED");
});

test("campaign drafts need a district and a known component", async () => {
  const s = store();
  const base = { ...outreach("x"), kind: "DONATION_CAMPAIGN" as const, requestId: null };
  assert.equal((await s.createDraft({ ...base, district: null })).ok, false);
  assert.equal((await s.createDraft({ ...base, district: "Pune", component: "UNKNOWN" })).ok, false);
  assert.equal((await s.createDraft({ ...base, district: "Pune" })).ok, true);
});
