/**
 * Typed client for the Python forecast service (services/forecast).
 * Validates the query before sending and the JSON after receiving.
 * Used by the Next.js `/api/forecast` proxy and the Copilot `get_forecast` tool.
 */
import type { ForecastQuery, ForecastResponse } from "@raktdoot/shared";
import {
  backtestResponseSchema,
  districtSchema,
  forecastHealthSchema,
  forecastQuerySchema,
  forecastResponseSchema,
  type BacktestResponse,
  type ForecastHealth,
} from "./schemas.ts";

export const DEFAULT_FORECAST_TIMEOUT_MS = 20_000; // free instances can be slow to wake

export class ForecastServiceError extends Error {
  /** HTTP status from the service, 400 for an invalid query, null if unreachable. */
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ForecastServiceError";
    this.status = status;
  }
}

export interface ForecastClient {
  forecast(query: ForecastQuery): Promise<ForecastResponse>;
  backtest(district: string): Promise<BacktestResponse>;
  health(): Promise<ForecastHealth>;
}

export interface ForecastClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ParseSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { message: string } };
}

export function createForecastClient(options: ForecastClientOptions): ForecastClient {
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s]+$/.test(baseUrl)) {
    throw new Error("Forecast service URL must start with http:// or https://");
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_FORECAST_TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? fetch;

  async function request<T>(path: string, schema: ParseSchema<T>, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ForecastServiceError(`Forecast service unreachable (${baseUrl}): ${reason}`);
    }

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const detail =
        body !== null && typeof body === "object" && "detail" in body
          ? JSON.stringify((body as { detail: unknown }).detail)
          : text.slice(0, 200);
      throw new ForecastServiceError(`Forecast service returned ${response.status}: ${detail}`, response.status);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ForecastServiceError(`Forecast service sent an invalid response: ${parsed.error.message}`, 502);
    }
    return parsed.data;
  }

  return {
    async forecast(query) {
      const parsedQuery = forecastQuerySchema.safeParse(query);
      if (!parsedQuery.success) {
        throw new ForecastServiceError(`Invalid forecast query: ${parsedQuery.error.message}`, 400);
      }
      return request("/forecast", forecastResponseSchema, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedQuery.data),
      });
    },

    async backtest(district) {
      const parsedDistrict = districtSchema.safeParse(district);
      if (!parsedDistrict.success) {
        throw new ForecastServiceError(`Invalid district: ${parsedDistrict.error.message}`, 400);
      }
      return request(`/backtest?district=${encodeURIComponent(parsedDistrict.data)}`, backtestResponseSchema);
    },

    async health() {
      return request("/health", forecastHealthSchema);
    },
  };
}

/** Reads FORECAST_SERVICE_URL (default http://localhost:8000) and FORECAST_TIMEOUT_MS. */
export function forecastClientFromEnv(env: Record<string, string | undefined> = process.env): ForecastClient {
  const timeout = Number(env.FORECAST_TIMEOUT_MS);
  return createForecastClient({
    baseUrl: env.FORECAST_SERVICE_URL || "http://localhost:8000",
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : undefined,
  });
}
