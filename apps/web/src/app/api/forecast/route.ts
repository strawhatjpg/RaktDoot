// Owner: M3. POST /api/forecast → ForecastResponse (contracts.ts). Synthetic data; staff only.
import { forecastQuerySchema } from "@raktdoot/copilot";
import { requireStaff } from "../../../server/copilot/index.ts";
import { getForecastClient } from "../../../server/forecast/client.ts";
import { toApiError } from "../../../server/forecast/errors.ts";
import { ApiError, apiError, json, readJson } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireStaff(request);
    const query = forecastQuerySchema.safeParse(await readJson(request));
    if (!query.success) throw new ApiError(400, "VALIDATION_ERROR", "Check the forecast query");
    return json(await getForecastClient().forecast(query.data));
  } catch (error) {
    return apiError(toApiError(error));
  }
}
