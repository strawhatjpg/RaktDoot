// POST /api/auth/whatsapp/start → { code, link, expiresAt, botConfigured }
// The user sends "LOGIN <code>" on WhatsApp (or in the simulator); the app polls /poll.
import { botNumber, whatsappLogin } from "../../../../../server/auth/login.ts";
import { apiError, json } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const number = botNumber();
    const started = await whatsappLogin().start(number || "0");
    return json({ ...started, link: number ? started.link : null, botConfigured: number !== "" });
  } catch (error) { return apiError(error); }
}
