/**
 * Free-tier LLM client. Gemini (OpenAI-compatible endpoint) is primary; Groq is the
 * fallback on 429 / 5xx / network errors. Plain fetch, no SDK dependency.
 * Only demo / synthetic data may be sent (free tiers may be used for training).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LlmClient {
  /** Returns the parsed JSON object produced by the model. */
  completeJson(messages: ChatMessage[], opts?: { temperature?: number }): Promise<unknown>;
  completeText(messages: ChatMessage[], opts?: { temperature?: number }): Promise<string>;
}

export class LlmError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;
  constructor(message: string, status: number | undefined, retryable: boolean) {
    super(message);
    this.name = "LlmError";
    this.status = status;
    this.retryable = retryable;
  }
}

export function providersFromEnv(env: Record<string, string | undefined> = process.env): LlmProvider[] {
  const list: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) {
    list.push({
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || "gemini-flash-latest",
    });
  }
  if (env.GROQ_API_KEY) {
    list.push({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || "openai/gpt-oss-20b",
    });
  }
  return list;
}

type FetchFn = typeof fetch;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strip ```json fences some models add even in JSON mode. */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new LlmError("Model did not return JSON", undefined, false);
  }
}

export function createLlmClient(
  providers: LlmProvider[] = providersFromEnv(),
  options: { fetchFn?: FetchFn; timeoutMs?: number; retriesPerProvider?: number } = {},
): LlmClient {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const retries = options.retriesPerProvider ?? 1;

  async function call(p: LlmProvider, messages: ChatMessage[], json: boolean, temperature: number): Promise<string> {
    const body: Record<string, unknown> = { model: p.model, messages, temperature };
    if (json) body.response_format = { type: "json_object" };
    let res: Response;
    try {
      res = await fetchFn(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new LlmError(`${p.name}: network error ${(err as Error).message}`, undefined, true);
    }
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new LlmError(`${p.name}: HTTP ${res.status}`, res.status, retryable);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new LlmError(`${p.name}: empty response`, res.status, true);
    }
    return content;
  }

  async function run(messages: ChatMessage[], json: boolean, temperature: number): Promise<string> {
    if (providers.length === 0) throw new LlmError("No AI provider configured (set GEMINI_API_KEY or GROQ_API_KEY)", undefined, false);
    let last: unknown;
    for (const p of providers) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await call(p, messages, json, temperature);
        } catch (err) {
          last = err;
          if (!(err instanceof LlmError) || !err.retryable) break; // try next provider
          if (attempt < retries) await sleep(400 * 2 ** attempt);
        }
      }
    }
    throw last instanceof Error ? last : new LlmError("All AI providers failed", undefined, false);
  }

  return {
    async completeJson(messages, opts) {
      return parseJsonLoose(await run(messages, true, opts?.temperature ?? 0));
    },
    async completeText(messages, opts) {
      return run(messages, false, opts?.temperature ?? 0.2);
    },
  };
}