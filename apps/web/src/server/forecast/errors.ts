// Owner: M3. Maps forecast/Copilot failures to M2's ApiError shape ({ error: { code, message } }).
import { ForecastServiceError, isRateLimitError } from "@raktdoot/copilot";
import { ApiError } from "../http.ts";

export function toApiError(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  if (error instanceof ForecastServiceError) {
    if (error.status === null) return new ApiError(503, "FORECAST_UNAVAILABLE", "Forecast service is not reachable");
    if (error.status === 404) return new ApiError(404, "NOT_FOUND", error.message);
    if (error.status === 400 || error.status === 422) return new ApiError(400, "VALIDATION_ERROR", error.message);
    return new ApiError(502, "FORECAST_ERROR", "Forecast service returned an error");
  }
  if (isRateLimitError(error)) return new ApiError(429, "AI_RATE_LIMITED", "AI provider is busy; try again shortly");
  if (error instanceof Error && /No LLM provider/.test(error.message)) {
    return new ApiError(503, "AI_NOT_CONFIGURED", "Copilot needs GEMINI_API_KEY + GEMINI_MODEL (or Groq) in .env");
  }
  if (error instanceof Error && /^Question /.test(error.message)) return new ApiError(400, "VALIDATION_ERROR", error.message);
  return error;
}
