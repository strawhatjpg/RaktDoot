// POST /api/intake/extract { text } → ExtractedRequest (+ usedAi). Signed-in users only.
// Reuses M1's multilingual pipeline: rules first, Gemini → Groq when configured.
// The app shows the result as an editable form; nothing is created until the user confirms.
import { createLlmClient, extractRequest, providersFromEnv } from "@raktdoot/bot";
import { requireActor } from "../../../../server/auth/session.ts";
import { ApiError, apiError, json, readJson } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireActor(request);
    const body = (await readJson(request)) as { text?: unknown } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text.length < 2 || text.length > 2000) throw new ApiError(400, "VALIDATION_ERROR", "Describe the need in 2-2000 characters", { text: "required" });
    const providers = providersFromEnv(process.env);
    const llm = providers.length ? createLlmClient(providers) : null;
    return json({ extraction: await extractRequest(text, { llm }) });
  } catch (error) { return apiError(error); }
}
