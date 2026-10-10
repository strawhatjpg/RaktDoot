import { createSession, sessionCookie } from "../../../../../server/auth/session.ts";
import { clearOAuthCookie, exchangeGoogleCode, findOrCreateOAuthUser, googleConfig, readOAuthCookie, statesMatch } from "../../../../../server/auth/oauth.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(base: string, path: string, cookies: string[]): Response {
  const headers = new Headers({ Location: new URL(path, base).toString(), "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request): Promise<Response> {
  const config = googleConfig();
  const base = process.env.APP_BASE_URL ?? new URL(request.url).origin;
  if (!config) return back(base, "/login?error=not_configured", []);
  const params = new URL(request.url).searchParams;
  const saved = readOAuthCookie(request.headers.get("cookie"));
  const code = params.get("code");
  const state = params.get("state");
  if (params.get("error") || !code || !state || !saved || !statesMatch(state, saved.state)) {
    return back(base, "/login?error=oauth", [clearOAuthCookie()]);
  }
  try {
    const profile = await exchangeGoogleCode(config, code, saved.verifier);
    const user = await findOrCreateOAuthUser("google", profile);
    const session = await createSession(user.id);
    return back(base, saved.returnTo, [clearOAuthCookie(), sessionCookie(session.token, session.expiresAt)]);
  } catch {
    return back(base, "/login?error=oauth", [clearOAuthCookie()]);
  }
}