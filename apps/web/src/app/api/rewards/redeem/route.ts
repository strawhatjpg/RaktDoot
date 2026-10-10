import { requireActor } from "../../../../server/auth/session.ts";
import { apiError, json, readJson } from "../../../../server/http.ts";
import { redeem } from "../../../../server/rewards/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { itemId } + Idempotency-Key — spend coins for one sponsor coupon code. */
export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const body = (await readJson(request)) as { itemId?: unknown } | null;
    const result = await redeem(actor, body?.itemId, request.headers.get("idempotency-key"));
    return json(result, result.replayed ? 200 : 201);
  } catch (error) { return apiError(error); }
}