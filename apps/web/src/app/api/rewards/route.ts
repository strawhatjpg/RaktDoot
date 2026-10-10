import { requireActor } from "../../../server/auth/session.ts";
import { apiError, json } from "../../../server/http.ts";
import { getWallet } from "../../../server/rewards/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — own coin balance, ledger, referral link + stats, redeemed coupon codes. */
export async function GET(request: Request): Promise<Response> {
  try { return json(await getWallet(await requireActor(request))); }
  catch (error) { return apiError(error); }
}