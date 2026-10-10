import { requireActor } from "../../../../../server/auth/session.ts";
import { apiError, json, readJson } from "../../../../../server/http.ts";
import { recordFulfilment } from "../../../../../server/outreach/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { units, source: DONOR_DONATION|CENTRE_STOCK, note? } — units issued to the patient. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return json(await recordFulfilment(actor, id, await readJson(request)), 201);
  } catch (error) { return apiError(error); }
}