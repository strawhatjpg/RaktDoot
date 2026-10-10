/** Test helpers: fake forecast service + scripted model for the real Cline SDK Agent. */
import { Agent } from "@cline/sdk";
import type { ForecastResponse } from "@raktdoot/shared";
import type { ForecastClient } from "../src/forecast-client.ts";

export const SAMPLE_FORECAST: ForecastResponse = {
  district: "Pune",
  generatedAt: "2026-10-10T10:00:00Z",
  isSynthetic: true,
  backtest: { modelMae: 8.48, baselineMae: 11.05, weeksTested: 24 },
  points: [
    { weekStart: "2026-09-28", bloodGroup: "O+", component: "PLATELETS", p10: 113, p50: 204, p90: 277, expectedSupply: 137, shortageRisk: 0.83, drivers: ["Dengue season (week 40): platelet demand usually rises"] },
    { weekStart: "2026-09-28", bloodGroup: "O+", component: "PLASMA", p10: 23, p50: 33, p90: 49, expectedSupply: 32, shortageRisk: 0.52, drivers: ["In line with same week last year (31 units)"] },
    { weekStart: "2026-10-05", bloodGroup: "B+", component: "PACKED_RED_CELLS", p10: 120, p50: 170, p90: 240, expectedSupply: 190, shortageRisk: 0.31, drivers: [] },
  ],
};

export function fakeForecastClient(response: ForecastResponse = SAMPLE_FORECAST): ForecastClient & { queries: unknown[] } {
  const queries: unknown[] = [];
  return {
    queries,
    async forecast(query) {
      queries.push(query);
      return structuredClone(response);
    },
    async backtest(district) {
      return { district, isSynthetic: true, modelMae: 8.48, baselineMae: 11.05, weeksTested: 24, intervalCoverage: 0.78, weekly: [] };
    },
    async health() {
      return { status: "ok", isSynthetic: true, districts: ["Pune"], lastHistoryWeek: "2026-09-21" };
    },
  };
}

export interface ToolCallStep {
  tool: string;
  input: Record<string, unknown>;
}

type ModelEvent = Record<string, unknown>;
type AgentModelLike = { stream: (request: { messages: readonly unknown[] }) => AsyncIterable<ModelEvent> };

/**
 * Scripted model: emits each tool call in turn, then a final text built from the
 * tool results it has seen. Lets tests run the real Cline SDK loop offline.
 */
export function scriptedModel(steps: ToolCallStep[], finalText: (toolResults: unknown[]) => string): AgentModelLike {
  let turn = 0;
  return {
    async *stream(request) {
      const step = steps[turn];
      turn++;
      if (step) {
        yield { type: "tool-call-delta", toolCallId: `call-${turn}`, toolName: step.tool, input: step.input };
        yield { type: "finish", reason: "tool-calls" };
        return;
      }
      const results = request.messages.flatMap((m) => {
        const content = (m as { role: string; content: Array<{ type: string; output?: unknown }> }).content;
        return (m as { role: string }).role === "tool" ? content.filter((p) => p.type === "tool-result").map((p) => p.output) : [];
      });
      yield { type: "text-delta", text: finalText(results) };
      yield { type: "finish", reason: "stop" };
    },
  };
}

/** createAgent seam that swaps the provider for a scripted model but keeps every other option. */
export function agentWithModel(model: AgentModelLike) {
  return (config: ConstructorParameters<typeof Agent>[0]) => {
    const { providerId: _p, modelId: _m, apiKey: _k, ...rest } = config as Record<string, unknown>;
    return new Agent({ ...rest, model } as unknown as ConstructorParameters<typeof Agent>[0]);
  };
}

export const noSleep = async () => {};
