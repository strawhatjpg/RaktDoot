// GET /api/auth/whatsapp/poll?code=123456 → { status: pending | expired } or sets the session cookie.
import { sessionForPhone, whatsappLogin } from "../../../../../server/auth/login.ts";
import { ApiError, apiError, json } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const code = new URL(request.url).searchParams.get("code") ?? "";
    if (!/^\d{6}$/.test(code)) throw new ApiError(400, "VALIDATION_ERROR", "code must be 6 digits");
    const result = await whatsappLogin().poll(code);
    if (result.status === "confirmed" && result.phone) return sessionForPhone(result.phone);
    return json({ status: result.status });
  } catch (error) { return apiError(error); }
}
