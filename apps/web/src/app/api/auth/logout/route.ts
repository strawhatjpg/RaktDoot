// POST /api/auth/logout → deletes the current session and clears the cookie.
import { createHash } from "node:crypto";
import { SESSION_COOKIE } from "../../../../server/auth/session.ts";
import { getDb } from "../../../../server/db.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get("cookie")?.split(";").map((p) => p.trim())
    .find((p) => p.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await getDb().session.deleteMany({ where: { tokenHash } }).catch(() => undefined);
  }
  return Response.json({ ok: true }, {
    headers: { "Cache-Control": "no-store", "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` },
  });
}
