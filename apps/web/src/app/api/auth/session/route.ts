import { createHash } from "node:crypto";
import { requireActor, SESSION_COOKIE } from "../../../../server/auth/session.ts";
import { getDb } from "../../../../server/db.ts";
import { apiError, json } from "../../../../server/http.ts";
import { googleConfig } from "../../../../server/auth/oauth.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → who am I (401 when signed out). Also reports which sign-in methods are configured. */
export async function GET(request: Request): Promise<Response> {
  const methods = { google: googleConfig() !== null, whatsapp: Boolean(process.env.WHATSAPP_BOT_NUMBER), demo: process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production" };
  try {
    const actor = await requireActor(request);
    const user = await getDb().user.findUniqueOrThrow({ where: { id: actor.userId }, select: { name: true, role: true, phone: true, email: true, donorProfile: { select: { bloodGroup: true } } } });
    return json({ signedIn: true, user: { id: actor.userId, name: user.name, role: user.role, verifiedStaff: actor.verified && user.role !== "REQUESTER" && user.role !== "DONOR", hasPhone: user.phone !== null, email: user.email, isDonor: user.donorProfile !== null }, methods });
  } catch {
    return json({ signedIn: false, methods });
  }
}

/** DELETE → sign out (revokes this session server-side). */
export async function DELETE(request: Request): Promise<Response> {
  try {
    await requireActor(request);
    const token = request.headers.get("cookie")?.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    if (token) await getDb().session.deleteMany({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
    return new Response(JSON.stringify({ signedIn: false }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } });
  } catch (error) { return apiError(error); }
}