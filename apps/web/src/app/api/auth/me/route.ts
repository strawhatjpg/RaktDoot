// GET /api/auth/me → the signed-in user (no phone number is returned).
import { requireActor } from "../../../../server/auth/session.ts";
import { getDb } from "../../../../server/db.ts";
import { apiError, json } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const user = await getDb().user.findUnique({ where: { id: actor.userId }, select: { name: true, preferredLanguage: true, donorProfile: { select: { userId: true } } } });
    return json({
      user: {
        id: actor.userId, name: user?.name ?? "", role: actor.role, verified: actor.verified,
        district: actor.district, hospitalId: actor.hospitalId, language: user?.preferredLanguage ?? "en",
        isDonor: Boolean(user?.donorProfile),
      },
    });
  } catch (error) { return apiError(error); }
}
