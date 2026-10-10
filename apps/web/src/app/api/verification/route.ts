import { requireActor } from "../../../server/auth/session.ts";
import { apiError, json } from "../../../server/http.ts";
import { listVerificationQueue } from "../../../server/outreach/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — requests awaiting verification in the signed-in staff member's scope. */
export async function GET(request: Request): Promise<Response> {
  try { return json({ queue: await listVerificationQueue(await requireActor(request)) }); }
  catch (error) { return apiError(error); }
}