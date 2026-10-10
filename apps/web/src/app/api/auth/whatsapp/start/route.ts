// Owner: M1. Step 1 of "Log in with WhatsApp".
// POST → { code, link, expiresAt }. The app shows the code and opens the wa.me link,
// which pre-fills "LOGIN <code>" to the bot. Sets an HttpOnly cookie binding the code to this browser.
import { getBot } from "../../../../../server/bot/index.ts";
import { bindCode, loginCookie } from "../../../../../server/bot/login.ts";
import { ApiError, apiError } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const botNumber = process.env.WHATSAPP_BOT_NUMBER ?? "";
    if (!/\d{8,15}/.test(botNumber.replace(/\D/g, ""))) {
      throw new ApiError(503, "NOT_CONFIGURED", "WhatsApp login is not configured");
    }
    const started = await getBot().login.start(botNumber);
    const secret = bindCode(started.code);
    return Response.json(started, {
      status: 201,
      headers: { "Cache-Control": "no-store", "Set-Cookie": loginCookie(secret, 300) },
    });
  } catch (error) {
    return apiError(error);
  }
}
