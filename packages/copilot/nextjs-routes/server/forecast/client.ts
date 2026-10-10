// apps/web/src/server/forecast/client.ts
// Server-only singleton for the Python forecast service.
import { forecastClientFromEnv, type ForecastClient } from "@raktdoot/copilot";

let client: ForecastClient | null = null;

export function getForecastClient(): ForecastClient {
  client ??= forecastClientFromEnv(process.env);
  return client;
}
