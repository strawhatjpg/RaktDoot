/** One-call wiring from environment variables (used by Next.js routes and the CLI). */
import { createLlmClient, providersFromEnv } from "./ai/llm-client.ts";
import { createGroqTranscriber } from "./ai/transcribe.ts";
import { createMemoryLoginStore, createWhatsAppLogin, type LoginCodeStore } from "./auth/whatsapp-login.ts";
import { configFromEnv, createWhatsAppClient } from "./channels/whatsapp-client.ts";
import type { BotDeps } from "./conversation/bot-flow.ts";
import { createMockCoreApi, type CoreApi } from "./core-api.ts";

export function createBotFromEnv(
  env: Record<string, string | undefined> = process.env,
  overrides: { core?: CoreApi; loginStore?: LoginCodeStore } = {},
) {
  const providers = providersFromEnv(env);
  const waConfig = configFromEnv(env);
  const client = waConfig ? createWhatsAppClient(waConfig) : null;
  const login = createWhatsAppLogin(overrides.loginStore ?? createMemoryLoginStore());
  const bot: BotDeps = {
    core: overrides.core ?? createMockCoreApi(env.APP_BASE_URL),
    llm: providers.length ? createLlmClient(providers) : null,
    transcriber: createGroqTranscriber(env),
    login,
    appBaseUrl: env.APP_BASE_URL || "http://localhost:3000",
    ...(client ? { downloadAudio: client.downloadMedia } : {}),
  };
  return { bot, client, login, providers: providers.map((p) => p.name) };
}