import { requireActor } from "../../../../server/auth/session.ts";
import { deleteDonorLocation, updateDonorLocation } from "../../../../server/donors/service.ts";
import { apiError, json, readJson } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** App GPS or typed area only; WhatsApp pins arrive through M1's verified webhook. */
export async function PUT(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    return json({ profile: await updateDonorLocation(actor, await readJson(request)) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request): Promise<Response> {
  try { return json(await deleteDonorLocation(await requireActor(request))); }
  catch (error) { return apiError(error); }
}