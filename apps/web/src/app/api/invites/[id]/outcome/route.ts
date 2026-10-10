import { requireActor } from "../../../../../server/auth/session.ts";
import { apiError, json, readJson } from "../../../../../server/http.ts";
import { flushOutbox } from "../../../../../server/notifications/sender.ts";
import { recordDonorOutcome } from "../../../../../server/outreach/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { outcome: ARRIVED|DONATED|DEFERRED|NO_SHOW } — staff record what happened. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const result = await recordDonorOutcome(actor, id, await readJson(request));
    await flushOutbox();
    return json(result);
  } catch (error) { return apiError(error); }
}