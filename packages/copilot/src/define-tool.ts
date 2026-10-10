/** Wraps `createTool` from the Cline SDK with zod validation of LLM-provided input. */
import { createTool } from "@cline/sdk";
import type { z } from "zod";
import type { ApprovalStore } from "./approval.ts";
import type { CopilotDataSource } from "./data-source.ts";
import type { ForecastClient } from "./forecast-client.ts";
import { toToolInputSchema } from "./schemas.ts";

export interface ToolDeps {
  data: CopilotDataSource;
  forecast: ForecastClient;
  approvals: ApprovalStore;
  /** Optional hook so the caller can show which tools ran (UI trace). */
  onToolCall?: (name: string, ok: boolean) => void;
}

export type ToolResult = Record<string, unknown>;

/** Invalid input or handler errors are returned to the model as `{ error }`, never thrown. */
export function defineTool<S extends z.ZodType>(
  deps: ToolDeps,
  name: string,
  description: string,
  schema: S,
  handler: (input: z.infer<S>) => Promise<ToolResult>,
) {
  return createTool<unknown, ToolResult>({
    name,
    description,
    inputSchema: toToolInputSchema(schema),
    timeoutMs: 30_000,
    execute: async (raw: unknown) => {
      const parsed = schema.safeParse(raw ?? {});
      if (!parsed.success) {
        deps.onToolCall?.(name, false);
        return { error: `Invalid input: ${parsed.error.message}` };
      }
      try {
        const result = await handler(parsed.data);
        deps.onToolCall?.(name, !("error" in result));
        return result;
      } catch (error) {
        deps.onToolCall?.(name, false);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });
}
