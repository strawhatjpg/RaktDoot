import { requireActor } from "../../../server/auth/session.ts";
import { apiError, json, readJson } from "../../../server/http.ts";
import { createBloodRequest, listOwnRequests } from "../../../server/requests/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const result = await createBloodRequest(actor, await readJson(request), request.headers.get("idempotency-key"));
    return json(result, result.replayed ? 200 : 201);
  } catch (error) { return apiError(error); }
}

export async function GET(request: Request): Promise<Response> {
  try { return json({ requests: await listOwnRequests(await requireActor(request)) }); }
  catch (error) { return apiError(error); }
}