import { requireActor } from "../../../../../server/auth/session.ts";
import { apiError, json, readJson } from "../../../../../server/http.ts";
import { flushOutbox } from "../../../../../server/notifications/sender.ts";
import { closeRequest } from "../../../../../server/outreach/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { outcome } — FULFILLED needs issued units; requesters may only CANCELLED. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const result = await closeRequest(actor, id, await readJson(request));
    await flushOutbox();
    return json(result);
  } catch (error) { return apiError(error); }
}