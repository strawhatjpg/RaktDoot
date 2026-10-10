import { googleConfig, startGoogleLogin } from "../../../../../server/auth/oauth.ts";
import { ApiError, apiError } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/google/start?returnTo=/request → 302 to Google's consent screen. */
export function GET(request: Request): Response {
  try {
    const config = googleConfig();
    if (!config) throw new ApiError(503, "NOT_CONFIGURED", "Google sign-in is not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)");
    const { url, cookie } = startGoogleLogin(config, new URL(request.url).searchParams.get("returnTo") ?? "/");
    return new Response(null, { status: 302, headers: { Location: url, "Set-Cookie": cookie, "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}