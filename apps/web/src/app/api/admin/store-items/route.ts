import { requireActor } from "../../../../server/auth/session.ts";
import { apiError, json, readJson } from "../../../../server/http.ts";
import { createStoreItem } from "../../../../server/rewards/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { sponsorName, title, description, costCoins, couponCodes[] } — admin only. */
export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    return json(await createStoreItem(actor, await readJson(request)), 201);
  } catch (error) { return apiError(error); }
}