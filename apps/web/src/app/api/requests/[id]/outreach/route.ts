import { requireActor } from "../../../../../server/auth/session.ts";
import { apiError, json } from "../../../../../server/http.ts";
import { flushOutbox } from "../../../../../server/notifications/sender.ts";
import { caseOutreach, startWave } from "../../../../../server/outreach/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — waves, invites and progress for staff. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return json(await caseOutreach(actor, id));
  } catch (error) { return apiError(error); }
}

/** POST — start the next wave; WhatsApp invites are sent right after the commit. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const result = await startWave(actor, id);
    await flushOutbox();
    return json(result, 201);
  } catch (error) { return apiError(error); }
}