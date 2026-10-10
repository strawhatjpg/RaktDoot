/**
 * Coordinator Copilot built on the Cline SDK (`Agent` + custom tools).
 * Free tiers only: Gemini primary, Groq fallback on rate limits (docs/FREE_STACK.md).
 */
import { Agent } from "@cline/sdk";
import type { ApprovalStore } from "./approval.ts";
import type { CopilotDataSource } from "./data-source.ts";
import type { ForecastClient } from "./forecast-client.ts";
import { COPILOT_TOOL_NAMES, createCopilotTools } from "./tools.ts";

export const COPILOT_SYSTEM_PROMPT = `You are RaktDoot Coordinator Copilot, an assistant for blood-access coordinators in India.

Scope: open blood requests, licensed blood centres, donor ranking, demand forecasts and outreach drafts. Politely decline anything else.

Rules (never break them):
1. Ground every fact in tool results. Never invent requests, stock, donors or numbers. If a tool fails, say so.
2. You never decide clinical urgency, donor fitness, blood compatibility or substitution, stock existence or request verification. Defer to hospital and blood-centre staff.
3. Donors donate only at licensed blood centres. Private donors are contacted only for VERIFIED requests.
4. You cannot send messages, close cases or edit records. You may only create drafts with draft_outreach_message; say clearly that a coordinator must approve them.
5. Forecasts are ranges (P10-P90). When isSynthetic is true, say "synthetic data" and quote the backtest error vs baseline.
6. Simulated stock (isSimulated) must be called simulated. Say "may be eligible", never "is eligible".
7. Never reveal phone numbers. Refer to donors by first name only.

Answer in the coordinator's language (English, Hindi, Hinglish or Marathi). Be brief: a short summary, then bullet points, then suggested next actions and any draft IDs.`;

export interface ProviderConfig {
  providerId: "gemini" | "groq";
  modelId: string;
  apiKey: string;
}

export interface CopilotConfig {
  data: CopilotDataSource;
  forecast: ForecastClient;
  approvals: ApprovalStore;
  /** Tried in order; next provider is used when one fails with a rate limit / quota error. */
  providers: ProviderConfig[];
  maxIterations?: number;
  /** Test seam: build the Cline SDK agent. Defaults to `new Agent(...)`. */
  createAgent?: (config: ConstructorParameters<typeof Agent>[0]) => Pick<Agent, "run">;
  sleep?: (ms: number) => Promise<void>;
}

export interface CopilotAnswer {
  text: string;
  provider: string;
  toolsUsed: string[];
  draftIds: string[];
  iterations: number;
}

export const MAX_QUESTION_LENGTH = 2000;
const DEFAULT_MAX_ITERATIONS = 8;
const RETRY_DELAY_MS = 2000;

export function isRateLimitError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${String((error as { status?: unknown }).status ?? "")}` : String(error);
  return /\b429\b|rate.?limit|quota|resource.?exhausted|too many requests/i.test(text);
}

/** Reads GEMINI_* (primary) and GROQ_* (fallback). Placeholder model IDs are ignored. */
export function providersFromEnv(env: Record<string, string | undefined> = process.env): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  const usable = (v: string | undefined): v is string => Boolean(v && !v.startsWith("replace-with"));
  if (usable(env.GEMINI_API_KEY) && usable(env.GEMINI_MODEL)) {
    providers.push({ providerId: "gemini", modelId: env.GEMINI_MODEL, apiKey: env.GEMINI_API_KEY });
  }
  if (usable(env.GROQ_API_KEY) && usable(env.GROQ_MODEL)) {
    providers.push({ providerId: "groq", modelId: env.GROQ_MODEL, apiKey: env.GROQ_API_KEY });
  }
  return providers;
}

export function createCopilot(config: CopilotConfig) {
  if (config.providers.length === 0) {
    throw new Error("No LLM provider configured: set GEMINI_API_KEY + GEMINI_MODEL (or GROQ_API_KEY + GROQ_MODEL)");
  }
  const build = config.createAgent ?? ((c) => new Agent(c));
  const sleep = config.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function ask(question: string): Promise<CopilotAnswer> {
    const prompt = question.trim();
    if (!prompt) throw new Error("Question is empty");
    if (prompt.length > MAX_QUESTION_LENGTH) throw new Error(`Question is longer than ${MAX_QUESTION_LENGTH} characters`);

    let lastError: unknown;
    for (const provider of config.providers) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const toolsUsed: string[] = [];
        const draftsBefore = new Set(config.approvals.list().map((d) => d.id));
        const agent = build({
          providerId: provider.providerId,
          modelId: provider.modelId,
          apiKey: provider.apiKey,
          systemPrompt: COPILOT_SYSTEM_PROMPT,
          tools: createCopilotTools({ ...config, onToolCall: (name) => toolsUsed.push(name) }),
          maxIterations: config.maxIterations ?? DEFAULT_MAX_ITERATIONS,
          // Defence in depth: only our own read/draft tools may ever run.
          toolPolicies: Object.fromEntries(COPILOT_TOOL_NAMES.map((n) => [n, { enabled: true, autoApprove: true }])),
          requestToolApproval: () => ({ approved: false, reason: "Copilot cannot run tools outside its allow-list" }),
        });
        try {
          const result = await agent.run(prompt);
          if (result.status === "failed") throw result.error ?? new Error("Copilot run failed");
          return {
            text: result.outputText.trim(),
            provider: `${provider.providerId}:${provider.modelId}`,
            toolsUsed,
            draftIds: config.approvals.list().map((d) => d.id).filter((id) => !draftsBefore.has(id)),
            iterations: result.iterations,
          };
        } catch (error) {
          lastError = error;
          if (!isRateLimitError(error)) throw error;
          if (attempt === 0) await sleep(RETRY_DELAY_MS); // one backoff retry, then next provider
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("All Copilot providers are rate-limited");
  }

  return { ask };
}
