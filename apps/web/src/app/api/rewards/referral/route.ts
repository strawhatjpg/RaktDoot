import { requireActor } from "../../../../server/auth/session.ts";
import { apiError, json, readJson } from "../../../../server/http.ts";
import { attachReferral } from "../../../../server/rewards/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { code } — a newly signed-up user attaches the referral link they arrived from. */
export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const body = (await readJson(request)) as { code?: unknown } | null;
    return json(await attachReferral(actor.userId, typeof body?.code === "string" ? body.code.toUpperCase() : body?.code));
  } catch (error) { return apiError(error); }
}