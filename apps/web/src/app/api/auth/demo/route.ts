/**
 * Demo sign-in (development only): sign in as a seeded FICTIONAL account so the
 * staff side of the demo works without real staff accounts. Refused in production
 * and unless DEMO_MODE=true. Only isSimulated users can be chosen.
 */
import { createSession, sessionCookie } from "../../../../server/auth/session.ts";
import { getDb } from "../../../../server/db.ts";
import { ApiError, apiError, readJson } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["demo-coordinator", "demo-hospital-staff", "demo-centre-staff", "demo-requester"];

export async function POST(request: Request): Promise<Response> {
  try {
    if (process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production") throw new ApiError(404, "NOT_FOUND", "Not found");
    const origin = request.headers.get("origin");
    if (!process.env.APP_BASE_URL || origin !== new URL(process.env.APP_BASE_URL).origin) throw new ApiError(403, "INVALID_ORIGIN", "A same-origin request is required");
    const userId = (await readJson(request) as { userId?: unknown } | null)?.userId;
    if (typeof userId !== "string" || !ALLOWED.includes(userId)) throw new ApiError(400, "VALIDATION_ERROR", `userId must be one of ${ALLOWED.join(", ")}`);
    const user = await getDb().user.findUnique({ where: { id: userId } });
    if (!user?.isSimulated) throw new ApiError(404, "NOT_FOUND", "Run the demo seed first");
    const session = await createSession(user.id);
    return new Response(JSON.stringify({ signedIn: true }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": sessionCookie(session.token, session.expiresAt) } });
  } catch (error) { return apiError(error); }
}