// apps/web/src/app/api/copilot/route.ts
import { MAX_QUESTION_LENGTH, isRateLimitError } from "@raktdoot/copilot";
import { z } from "zod";
import { approvals, getCopilot, getStaffRole, isStaff } from "@/server/copilot";

const bodySchema = z.object({ question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH) });

export async function POST(request: Request) {
  if (!isStaff(getStaffRole(request))) return Response.json({ error: "Staff only" }, { status: 403 });
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  try {
    const answer = await getCopilot().ask(body.data.question);
    const drafts = answer.draftIds.map((id) => approvals.get(id)).filter((d) => d !== null);
    return Response.json({ ...answer, drafts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = isRateLimitError(error) ? 429 : /No LLM provider/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
