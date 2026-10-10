// Owner: M3. GET /api/copilot/briefing?district=Pune → deterministic shortage briefing (no LLM).
import { buildShortageBriefing, districtSchema, formatBriefing } from "@raktdoot/copilot";
import { dataSourceFor, requireStaff } from "../../../../server/copilot/index.ts";
import { getForecastClient } from "../../../../server/forecast/client.ts";
import { toApiError } from "../../../../server/forecast/errors.ts";
import { ApiError, apiError, json } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireStaff(request);
    const fallback = actor.district ?? "";
    const district = districtSchema.safeParse(new URL(request.url).searchParams.get("district") ?? fallback);
    if (!district.success) throw new ApiError(400, "VALIDATION_ERROR", "district is required");
    const briefing = await buildShortageBriefing({ data: dataSourceFor(actor), forecast: getForecastClient() }, district.data);
    return json({ briefing, text: formatBriefing(briefing) });
  } catch (error) {
    return apiError(toApiError(error));
  }
}
