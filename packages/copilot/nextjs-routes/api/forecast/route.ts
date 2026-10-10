// apps/web/src/app/api/forecast/route.ts
import { ForecastServiceError, forecastQuerySchema } from "@raktdoot/copilot";
import { getForecastClient } from "@/server/forecast/client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = forecastQuerySchema.safeParse(body);
  if (!query.success) return Response.json({ error: query.error.message }, { status: 400 });
  try {
    return Response.json(await getForecastClient().forecast(query.data));
  } catch (error) {
    return forecastError(error);
  }
}

export function forecastError(error: unknown) {
  if (error instanceof ForecastServiceError) {
    const status = error.status === null ? 503 : error.status >= 500 ? 502 : error.status;
    return Response.json({ error: error.message }, { status });
  }
  return Response.json({ error: "Unexpected forecast error" }, { status: 500 });
}
