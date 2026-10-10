// apps/web/src/server/copilot/index.ts
// Wires the Copilot to data, forecast service and approval store (server-only singletons).
import {
  ApprovalStore,
  createCopilot,
  createMockDataSource,
  providersFromEnv,
  type CopilotDataSource,
} from "@raktdoot/copilot";
import { USER_ROLES, type UserRole } from "@raktdoot/shared";
import { getForecastClient } from "../forecast/client";

// TODO(M2 at Sync 2): replace with the DB-backed CopilotDataSource.
const data: CopilotDataSource = createMockDataSource();

export const approvals = new ApprovalStore({
  data,
  // TODO(M2 at Sync 2): hand approved drafts to outreach waves / notifications.
  onApproved: async (draft) => {
    console.info(`[copilot] draft ${draft.id} approved; dispatch not wired yet`);
  },
});

let copilot: ReturnType<typeof createCopilot> | null = null;

export function getCopilot() {
  copilot ??= createCopilot({ data, forecast: getForecastClient(), approvals, providers: providersFromEnv(process.env) });
  return copilot;
}

export function getCopilotData(): CopilotDataSource {
  return data;
}

/**
 * DEMO ONLY: role from the `x-demo-role` header.
 * TODO(M2): replace with the real staff session (src/server/auth/session.ts).
 */
export function getStaffRole(request: Request): UserRole | null {
  const role = request.headers.get("x-demo-role");
  return role && (USER_ROLES as readonly string[]).includes(role) ? (role as UserRole) : null;
}

export function isStaff(role: UserRole | null): boolean {
  return role !== null && role !== "REQUESTER" && role !== "DONOR";
}
