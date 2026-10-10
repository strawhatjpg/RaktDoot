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

const STAFF_ROLES = new Set(["HOSPITAL_STAFF", "BLOOD_CENTRE_STAFF", "COORDINATOR", "ADMIN"]);

/** COPILOT_DATA_SOURCE=mock uses simulated demo cases (no DB needed); default is the real DB. */
export function dataSourceFor(actor: ActorContext): CopilotDataSource {
  return process.env.COPILOT_DATA_SOURCE === "mock" ? createMockDataSource() : createDbDataSource(actor);
}

const globalStore = globalThis as unknown as { raktdootApprovals?: ApprovalStore };

/**
 * One draft store per server process (demo scope). Each request gets a view scoped
 * to the signed-in staff member, so safety re-checks follow their access rules.
 * TODO(M2): persist drafts in a Prisma table and dispatch approved drafts via outreach.
 */
export function approvalsFor(actor: ActorContext): ApprovalStore {
  globalStore.raktdootApprovals ??= new ApprovalStore({
    data: createMockDataSource(), // never used directly; every caller goes through scoped()
    onApproved: async (draft) => {
      // TODO(M2): hand to outreach waves / notifications. Nothing is sent yet.
      console.info(`[copilot] draft ${draft.id} approved; dispatch not wired yet`);
    },
  });
  return globalStore.raktdootApprovals.scoped(dataSourceFor(actor));
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
