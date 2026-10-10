import { requireActor } from "../../../../server/auth/session.ts";
import { apiError, json } from "../../../../server/http.ts";
import { getBloodRequest } from "../../../../server/requests/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return json(await getBloodRequest(actor, id));
  } catch (error) { return apiError(error); }
}