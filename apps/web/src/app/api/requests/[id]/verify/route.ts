import { requireActor } from "../../../../../server/auth/session.ts";
import { apiError, json, readJson } from "../../../../../server/http.ts";
import { verifyRequest } from "../../../../../server/outreach/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { decision: VERIFIED|REJECTED, method: "how it was checked" } — scoped staff only. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return json(await verifyRequest(actor, id, await readJson(request)));
  } catch (error) { return apiError(error); }
}