import { requireActor } from "../../../server/auth/session.ts";
import { getDonorProfile, upsertDonorProfile } from "../../../server/donors/service.ts";
import { apiError, json, readJson } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Own profile only. There is deliberately no route to read another donor's profile. */
export async function GET(request: Request): Promise<Response> {
  try { return json({ profile: await getDonorProfile(await requireActor(request)) }); }
  catch (error) { return apiError(error); }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const result = await upsertDonorProfile(actor, await readJson(request));
    return json({ profile: result.profile }, result.created ? 201 : 200);
  } catch (error) { return apiError(error); }
}