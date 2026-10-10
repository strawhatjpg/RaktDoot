// apps/web/src/app/api/forecast/backtest/route.ts
import { districtSchema } from "@raktdoot/copilot";
import { getForecastClient } from "@/server/forecast/client";
import { forecastError } from "../route";

export async function GET(request: Request) {
  const district = districtSchema.safeParse(new URL(request.url).searchParams.get("district") ?? "");
  if (!district.success) return Response.json({ error: "district is required" }, { status: 400 });
  try {
    return Response.json(await getForecastClient().backtest(district.data));
  } catch (error) {
    return forecastError(error);
  }
}
