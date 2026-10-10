// POST /api/simulator { from, text?, buttonId?, location? } → { replies: OutboundMessage[] }
// Same processInbound as WhatsApp (M1). Demo fallback when no Meta number is available.
import { simulate } from "@raktdoot/bot";
import { simulatorBot } from "../../../server/auth/login.ts";
import { ApiError, apiError, json, readJson } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readJson(request)) as Record<string, unknown> | null;
    const from = typeof body?.from === "string" ? body.from : "";
    if (!/^\+\d{8,15}$/.test(from)) throw new ApiError(400, "VALIDATION_ERROR", "from must be E.164, e.g. +919800000001");
    const text = typeof body?.text === "string" ? body.text.slice(0, 2000) : undefined;
    const buttonId = typeof body?.buttonId === "string" ? body.buttonId.slice(0, 100) : undefined;
    const loc = body?.location as { lat?: unknown; lng?: unknown; label?: unknown } | undefined;
    const location = loc && typeof loc.lat === "number" && typeof loc.lng === "number"
      ? { lat: loc.lat, lng: loc.lng, ...(typeof loc.label === "string" ? { label: loc.label.slice(0, 80) } : {}) }
      : undefined;
    if (!text && !buttonId && !location) throw new ApiError(400, "VALIDATION_ERROR", "Send text, a button or a location");
    const replies = await simulate({ from, ...(text ? { text } : {}), ...(buttonId ? { buttonId } : {}), ...(location ? { location } : {}) }, simulatorBot().bot);
    return json({ replies });
  } catch (error) {
    if (error instanceof RangeError) return apiError(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiError(error);
  }
}
