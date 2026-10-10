// Owner: M3. GET /api/copilot/drafts?status=PENDING_APPROVAL → Copilot drafts. Staff only.
import { DRAFT_STATUSES, type DraftStatus } from "@raktdoot/copilot";
import { approvalsFor, requireStaff } from "../../../../server/copilot/index.ts";
import { ApiError, apiError, json } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireStaff(request);
    const status = new URL(request.url).searchParams.get("status");
    if (status !== null && !(DRAFT_STATUSES as readonly string[]).includes(status)) {
      throw new ApiError(400, "VALIDATION_ERROR", `status must be one of ${DRAFT_STATUSES.join(", ")}`);
    }
    return json({ drafts: approvalsFor(actor).list((status as DraftStatus | null) ?? undefined) });
  } catch (error) {
    return apiError(error);
  }
}
