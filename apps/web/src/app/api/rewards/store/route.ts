import { requireActor } from "../../../../server/auth/session.ts";
import { apiError, json } from "../../../../server/http.ts";
import { listStore } from "../../../../server/rewards/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — active sponsor rewards with remaining stock (public; per-user counts when signed in). */
export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request).catch(() => null);
    return json({ items: await listStore(actor) });
  } catch (error) { return apiError(error); }
}