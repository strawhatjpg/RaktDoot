// Owner: M3. GET /api/forecast/backtest?district=Pune → model vs baseline chart data.
import { districtSchema } from "@raktdoot/copilot";
import { requireStaff } from "../../../../server/copilot/index.ts";
import { getForecastClient } from "../../../../server/forecast/client.ts";
import { toApiError } from "../../../../server/forecast/errors.ts";
import { ApiError, apiError, json } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireStaff(request);
    const district = districtSchema.safeParse(new URL(request.url).searchParams.get("district") ?? "");
    if (!district.success) throw new ApiError(400, "VALIDATION_ERROR", "district is required");
    return json(await getForecastClient().backtest(district.data));
  } catch (error) {
    return apiError(toApiError(error));
  }
}
