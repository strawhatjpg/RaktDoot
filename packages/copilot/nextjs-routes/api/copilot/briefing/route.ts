// apps/web/src/app/api/copilot/briefing/route.ts
// Deterministic shortage briefing (works without an LLM key).
import { buildShortageBriefing, districtSchema, formatBriefing } from "@raktdoot/copilot";
import { getCopilotData, getStaffRole, isStaff } from "@/server/copilot";
import { getForecastClient } from "@/server/forecast/client";
import { forecastError } from "../../forecast/route";

export async function GET(request: Request) {
  if (!isStaff(getStaffRole(request))) return Response.json({ error: "Staff only" }, { status: 403 });
  const district = districtSchema.safeParse(new URL(request.url).searchParams.get("district") ?? "");
  if (!district.success) return Response.json({ error: "district is required" }, { status: 400 });
  try {
    const briefing = await buildShortageBriefing({ data: getCopilotData(), forecast: getForecastClient() }, district.data);
    return Response.json({ briefing, text: formatBriefing(briefing) });
  } catch (error) {
    return forecastError(error);
  }
}
