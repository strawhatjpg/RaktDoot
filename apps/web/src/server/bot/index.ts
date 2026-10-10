// Owner: M1 (wiring) + M2 (core adapter). One bot instance per server process.
// The bot now runs on M2's Prisma-backed CoreApi: conversations, users, consents,
// requests, donor sign-up, locations and invite replies all hit the real database.
// Set BOT_CORE=mock to fall back to M1's in-memory mock (tests / offline demos).
import { createBotFromEnv, createMemoryLoginStore, type LoginCodeStore } from "@raktdoot/bot";
import { createPrismaCoreApi } from "./core-adapter.ts";

type Bot = ReturnType<typeof createBotFromEnv>;
const globalBot = globalThis as unknown as { raktdootBot?: Bot; raktdootLoginStore?: LoginCodeStore };

/** Login codes must survive hot reloads in dev, so the store is process-global. */
function loginStore(): LoginCodeStore {
  globalBot.raktdootLoginStore ??= createMemoryLoginStore();
  return globalBot.raktdootLoginStore;
}

export function getBot(): Bot {
  const core = process.env.BOT_CORE === "mock" ? undefined : createPrismaCoreApi(process.env.APP_BASE_URL || "http://localhost:3000");
  globalBot.raktdootBot ??= createBotFromEnv(process.env, { loginStore: loginStore(), ...(core ? { core } : {}) });
  return globalBot.raktdootBot;
}

/** Simulator is a demo tool: on in development, opt-in elsewhere with SIMULATOR_ENABLED=true. */
export function simulatorEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SIMULATOR_ENABLED === "true";
}
