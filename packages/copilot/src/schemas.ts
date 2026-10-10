/**
 * Runtime schemas for everything that crosses a process boundary:
 * forecast service JSON and Copilot tool inputs (LLM output).
 * Types mirror packages/shared/src/contracts.ts.
 */
import { z } from "zod";
import {
  BLOOD_COMPONENTS,
  BLOOD_GROUPS,
  REQUEST_STATUSES,
  type BloodComponent,
  type ForecastQuery,
  type ForecastResponse,
} from "@raktdoot/shared";

/** UNKNOWN is an intake placeholder; it is never forecast or campaigned for. */
export const FORECAST_COMPONENTS = ["WHOLE_BLOOD", "PACKED_RED_CELLS", "PLATELETS", "PLASMA"] as const satisfies readonly BloodComponent[];
export type ForecastComponent = (typeof FORECAST_COMPONENTS)[number];

export const MAX_HORIZON_WEEKS = 4;

export const bloodGroupSchema = z.enum(BLOOD_GROUPS);
export const bloodComponentSchema = z.enum(BLOOD_COMPONENTS);
export const forecastComponentSchema = z.enum(FORECAST_COMPONENTS);
export const requestStatusSchema = z.enum(REQUEST_STATUSES);
export const districtSchema = z.string().trim().min(1).max(80);

export const forecastQuerySchema = z.object({
  district: districtSchema,
  horizonWeeks: z.number().int().min(1).max(MAX_HORIZON_WEEKS),
  bloodGroups: z.array(bloodGroupSchema).min(1).optional(),
  components: z.array(forecastComponentSchema).min(1).optional(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const forecastPointSchema = z
  .object({
    weekStart: isoDate,
    bloodGroup: bloodGroupSchema,
    component: bloodComponentSchema,
    p10: z.number().nonnegative(),
    p50: z.number().nonnegative(),
    p90: z.number().nonnegative(),
    expectedSupply: z.number().nonnegative(),
    shortageRisk: z.number().min(0).max(1),
    drivers: z.array(z.string()),
  })
  .refine((p) => p.p10 <= p.p50 && p.p50 <= p.p90, { message: "quantiles must satisfy p10 <= p50 <= p90" });

export const forecastResponseSchema = z.object({
  district: z.string(),
  generatedAt: z.string(),
  isSynthetic: z.boolean(),
  backtest: z.object({
    modelMae: z.number().nonnegative(),
    baselineMae: z.number().nonnegative(),
    weeksTested: z.number().int().nonnegative(),
  }),
  points: z.array(forecastPointSchema),
});

/** `GET /backtest` (dashboard chart). Not part of contracts.ts. */
export const backtestResponseSchema = z.object({
  district: z.string(),
  isSynthetic: z.boolean(),
  modelMae: z.number().nonnegative(),
  baselineMae: z.number().nonnegative(),
  weeksTested: z.number().int().nonnegative(),
  intervalCoverage: z.number().min(0).max(1),
  weekly: z.array(z.object({ weekStart: isoDate, modelMae: z.number(), baselineMae: z.number() })),
});
export type BacktestResponse = z.infer<typeof backtestResponseSchema>;

export const forecastHealthSchema = z.object({
  status: z.string(),
  isSynthetic: z.boolean(),
  districts: z.array(z.string()),
  lastHistoryWeek: isoDate,
});
export type ForecastHealth = z.infer<typeof forecastHealthSchema>;

/** Compile-time guarantee that the schemas match the shared contracts. */
export function parseForecastQuery(value: unknown): ForecastQuery {
  return forecastQuerySchema.parse(value);
}
export function parseForecastResponse(value: unknown): ForecastResponse {
  return forecastResponseSchema.parse(value);
}

/**
 * Convert a zod schema to a provider-friendly JSON schema for tool definitions.
 * Some providers (e.g. Gemini function declarations) reject `$schema` and
 * `additionalProperties`, so they are stripped; zod still validates at runtime.
 */
export function toToolInputSchema(schema: z.ZodType): Record<string, unknown> {
  return stripUnsupportedKeys(z.toJSONSchema(schema, { io: "input" })) as Record<string, unknown>;
}

function stripUnsupportedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnsupportedKeys);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (key === "$schema" || key === "additionalProperties") continue;
    out[key] = stripUnsupportedKeys(inner);
  }
  return out;
}
