// Owner: M1. Step 2 of "Log in with WhatsApp".
// POST { code } → { status: "pending" | "expired" } or { status: "confirmed" } + session cookie.
// Only the browser that started the login (login cookie) can complete it.
import { createSession, sessionCookie } from "../../../../../server/auth/session.ts";
import { getBot } from "../../../../../server/bot/index.ts";
import { LOGIN_COOKIE, loginCookie, ownsCode, readCookie, releaseCode } from "../../../../../server/bot/login.ts";
import { findOrCreateUserByPhone } from "../../../../../server/bot/users.ts";
import { ApiError, apiError, json, readJson } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readJson(request)) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) throw new ApiError(400, "VALIDATION_ERROR", "code must be 6 digits", { code: "invalid" });
    if (!ownsCode(code, readCookie(request, LOGIN_COOKIE))) {
      throw new ApiError(403, "FORBIDDEN", "This login was started in another browser");
    }

    const result = await getBot().login.poll(code);
    if (result.status !== "confirmed" || !result.phone) {
      if (result.status === "expired") releaseCode(code);
      return json({ status: result.status });
    }

    releaseCode(code);
    const user = await findOrCreateUserByPhone(result.phone);
    const session = await createSession(user.id);
    const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json" });
    headers.append("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    headers.append("Set-Cookie", loginCookie("", 0)); // clear the one-time login cookie
    return new Response(JSON.stringify({ status: "confirmed" }), { status: 200, headers });
  } catch (error) {
    return apiError(error);
  }
}
