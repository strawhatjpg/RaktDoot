// Owner: M1. Step 1 of "Log in with WhatsApp".
// POST → { code, link, expiresAt, botConfigured }. The app shows the code and opens the wa.me link,
// which pre-fills "LOGIN <code>" to the bot. Sets an HttpOnly cookie binding the code to this browser.
// Without a bot number, the code can still be sent from the web simulator (when it is enabled);
// link is then null and botConfigured false.
import { getBot, simulatorEnabled } from "../../../../../server/bot/index.ts";
import { bindCode, loginCookie } from "../../../../../server/bot/login.ts";
import { ApiError, apiError } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const botNumber = process.env.WHATSAPP_BOT_NUMBER ?? "";
    const botConfigured = /\d{8,15}/.test(botNumber.replace(/\D/g, ""));
    if (!botConfigured && !simulatorEnabled()) {
      throw new ApiError(503, "NOT_CONFIGURED", "WhatsApp login is not configured");
    }
    const started = await getBot().login.start(botConfigured ? botNumber : "0");
    const secret = bindCode(started.code);
    return Response.json({ ...started, link: botConfigured ? started.link : null, botConfigured }, {
      status: 201,
      headers: { "Cache-Control": "no-store", "Set-Cookie": loginCookie(secret, 300) },
    });
  } catch (error) {
    return apiError(error);
  }
}
