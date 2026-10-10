// Owner: M3. POST /api/copilot { question } → grounded answer + pending drafts. Staff only.
import { MAX_QUESTION_LENGTH } from "@raktdoot/copilot";
import { approvalsFor, copilotFor, requireStaff } from "../../../server/copilot/index.ts";
import { toApiError } from "../../../server/forecast/errors.ts";
import { ApiError, apiError, json, readJson } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireStaff(request);
    const body = (await readJson(request)) as { question?: unknown } | null;
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_LENGTH) {
      throw new ApiError(400, "VALIDATION_ERROR", `question must be 1-${MAX_QUESTION_LENGTH} characters`, { question: "required" });
    }
    const answer = await copilotFor(actor).ask(question);
    const approvals = approvalsFor(actor);
    const drafts = answer.draftIds.map((id) => approvals.get(id)).filter((d) => d !== null);
    return json({ ...answer, drafts });
  } catch (error) {
    return apiError(toApiError(error));
  }
}
