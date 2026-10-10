// apps/web/src/app/api/copilot/drafts/route.ts
import { DRAFT_STATUSES, type DraftStatus } from "@raktdoot/copilot";
import { approvals, getStaffRole, isStaff } from "@/server/copilot";

export async function GET(request: Request) {
  if (!isStaff(getStaffRole(request))) return Response.json({ error: "Staff only" }, { status: 403 });
  const status = new URL(request.url).searchParams.get("status");
  if (status && !(DRAFT_STATUSES as readonly string[]).includes(status)) {
    return Response.json({ error: `status must be one of ${DRAFT_STATUSES.join(", ")}` }, { status: 400 });
  }
  return Response.json({ drafts: approvals.list((status as DraftStatus | null) ?? undefined) });
}
