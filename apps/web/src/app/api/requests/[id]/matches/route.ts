import { requireActor } from "../../../../../server/auth/session.ts";
import { apiError, json } from "../../../../../server/http.ts";
import { previewMatches } from "../../../../../server/outreach/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?wave=1 — ranked, explained candidates (first names only) + exclusion counts. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const wave = Number(new URL(request.url).searchParams.get("wave") ?? "1");
    return json(await previewMatches(actor, id, Number.isInteger(wave) ? wave : 1));
  } catch (error) { return apiError(error); }
}