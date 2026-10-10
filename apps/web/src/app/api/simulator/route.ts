// Owner: M1. Web WhatsApp simulator (demo fallback, no Meta account needed).
// POST { from, text? | buttonId? | location? } → { replies: OutboundMessage[] }. M4's /simulator page calls this.
import { simulate, type SimulatorInput } from "@raktdoot/bot";
import { getBot, simulatorEnabled } from "../../../server/bot/index.ts";
import { ApiError, apiError, json, readJson } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseInput(body: unknown): SimulatorInput {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const from = typeof b.from === "string" ? b.from.trim() : "";
  if (!/^\+\d{8,15}$/.test(from)) throw new ApiError(400, "VALIDATION_ERROR", "from must be E.164, e.g. +919800000001", { from: "invalid" });

  if (typeof b.buttonId === "string" && b.buttonId.length > 0 && b.buttonId.length <= 256) return { from, buttonId: b.buttonId };
  const loc = b.location as { lat?: unknown; lng?: unknown; label?: unknown } | undefined;
  if (loc && typeof loc === "object") {
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new ApiError(400, "VALIDATION_ERROR", "location must have valid lat/lng", { location: "invalid" });
    }
    return { from, location: typeof loc.label === "string" ? { lat, lng, label: loc.label.slice(0, 80) } : { lat, lng } };
  }
  if (typeof b.text === "string" && b.text.trim() && b.text.length <= 2000) return { from, text: b.text };
  throw new ApiError(400, "VALIDATION_ERROR", "Send one of text, buttonId or location", { text: "required" });
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!simulatorEnabled()) throw new ApiError(404, "NOT_FOUND", "Not found");
    const input = parseInput(await readJson(request));
    const replies = await simulate(input, getBot().bot);
    return json({ replies });
  } catch (error) {
    return apiError(error);
  }
}
