import { requireActor } from "../../../../server/auth/session.ts";
import { updateAvailability } from "../../../../server/donors/service.ts";
import { apiError, json, readJson } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    return json({ profile: await updateAvailability(actor, await readJson(request)) });
  } catch (error) { return apiError(error); }
}