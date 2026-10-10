// Owner: M3. POST /api/copilot/drafts/:id { action: approve | reject | edit }.
// The ONLY path from a Copilot draft to a message: explicit coordinator approval.
import { approvalsFor, requireApprover } from "../../../../../server/copilot/index.ts";
import { ApiError, apiError, json, readJson } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NOTE = 500;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireApprover(request);
    const { id } = await context.params;
    const approvals = approvalsFor(actor);
    if (!approvals.get(id)) throw new ApiError(404, "NOT_FOUND", "Draft not found");

    const body = (await readJson(request)) as { action?: unknown; note?: unknown; message?: unknown } | null;
    const note = typeof body?.note === "string" ? body.note.slice(0, MAX_NOTE) : undefined;

    let result;
    if (body?.action === "approve") result = await approvals.approve(id, actor.role, note);
    else if (body?.action === "reject") result = approvals.reject(id, actor.role, note);
    else if (body?.action === "edit" && typeof body.message === "string") result = approvals.editMessage(id, body.message, actor.role);
    else throw new ApiError(400, "VALIDATION_ERROR", "action must be approve, reject or edit (with message)", { action: "invalid" });

    if (!result.ok) throw new ApiError(409, "DRAFT_BLOCKED", result.reason);
    return json({ draft: result.draft });
  } catch (error) {
    return apiError(error);
  }
}
