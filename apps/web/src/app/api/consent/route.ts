import { requireActor } from "../../../server/auth/session.ts";
import { getConsentState, updateConsents } from "../../../server/consent/service.ts";
import { apiError, json, readJson } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try { return json(await getConsentState(await requireActor(request))); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    return json(await updateConsents(actor, await readJson(request), "APP"));
  } catch (error) { return apiError(error); }
}