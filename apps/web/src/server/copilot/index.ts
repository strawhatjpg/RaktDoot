// Owner: M3. Wires the Copilot (Cline SDK) to M2's DB, sessions and the forecast service.
import {
  ApprovalStore,
  createCopilot,
  createMockDataSource,
  isApproverRole,
  providersFromEnv,
  type CopilotDataSource,
} from "@raktdoot/copilot";
import type { ActorContext } from "@raktdoot/shared";
import { requireActor } from "../auth/session.ts";
import { ApiError } from "../http.ts";
import { getForecastClient } from "../forecast/client.ts";
import { createDbDataSource } from "./data-source.ts";
import { startWave } from "../outreach/service.ts";
import { flushOutbox } from "../notifications/sender.ts";

const STAFF_ROLES = new Set(["HOSPITAL_STAFF", "BLOOD_CENTRE_STAFF", "COORDINATOR", "ADMIN"]);

/** COPILOT_DATA_SOURCE=mock uses simulated demo cases (no DB needed); default is the real DB. */
export function dataSourceFor(actor: ActorContext): CopilotDataSource {
  return process.env.COPILOT_DATA_SOURCE === "mock" ? createMockDataSource() : createDbDataSource(actor);
}

const globalStore = globalThis as unknown as { raktdootApprovals?: ApprovalStore };

/**
 * One draft store per server process (demo scope). Each request gets a view scoped
 * to the signed-in staff member, so safety re-checks follow their access rules.
 * Approved DONOR_OUTREACH drafts start the next real wave as the approving coordinator.
 * DONATION_CAMPAIGN drafts are recorded only (campaign consent is a separate purpose
 * that has not been designed yet, so nothing is sent).
 */
const approverByDraft = new Map<string, ActorContext>();
export function approvalsFor(actor: ActorContext): ApprovalStore {
  globalStore.raktdootApprovals ??= new ApprovalStore({
    data: createMockDataSource(), // never used directly; every caller goes through scoped()
    onApproved: async (draft) => {
      const approver = approverByDraft.get(draft.id);
      approverByDraft.delete(draft.id);
      if (draft.kind !== "DONOR_OUTREACH" || !draft.requestId || !approver || process.env.COPILOT_DATA_SOURCE === "mock") return;
      await startWave(approver, draft.requestId);
      await flushOutbox();
    },
  });
  const scoped = globalStore.raktdootApprovals.scoped(dataSourceFor(actor));
  // Remember who approves so the wave runs with their (scoped) authority.
  const approve = scoped.approve.bind(scoped);
  scoped.approve = async (id, role, note) => { approverByDraft.set(id, actor); try { return await approve(id, role, note); } finally { approverByDraft.delete(id); } };
  return scoped;
}

export async function requireStaff(request: Request): Promise<ActorContext> {
  const actor = await requireActor(request);
  if (!actor.verified || !STAFF_ROLES.has(actor.role)) {
    throw new ApiError(403, "FORBIDDEN", "Copilot is available to verified staff only");
  }
  return actor;
}

export async function requireApprover(request: Request): Promise<ActorContext> {
  const actor = await requireStaff(request);
  if (!isApproverRole(actor.role)) throw new ApiError(403, "FORBIDDEN", "Only coordinators can approve drafts");
  return actor;
}

export function copilotFor(actor: ActorContext) {
  return createCopilot({
    data: dataSourceFor(actor),
    forecast: getForecastClient(),
    approvals: approvalsFor(actor),
    providers: providersFromEnv(process.env),
  });
}
