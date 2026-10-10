// Owner: M1. One bot instance per server process, wired from env.
// The bot runs on its in-memory CoreApi mock until M2's Prisma adapter lands
// (see docs/M2_HANDOFF.md "Integration with M1's CoreApi"); swap it in via `core`.
import { createBotFromEnv, createMemoryLoginStore, type LoginCodeStore } from "@raktdoot/bot";

type Bot = ReturnType<typeof createBotFromEnv>;
const globalBot = globalThis as unknown as { raktdootBot?: Bot; raktdootLoginStore?: LoginCodeStore };

/** Login codes must survive hot reloads in dev, so the store is process-global. */
function loginStore(): LoginCodeStore {
  globalBot.raktdootLoginStore ??= createMemoryLoginStore();
  return globalBot.raktdootLoginStore;
}

export function getBot(): Bot {
  globalBot.raktdootBot ??= createBotFromEnv(process.env, { loginStore: loginStore() });
  return globalBot.raktdootBot;
}

/** Simulator is a demo tool: on in development, opt-in elsewhere with SIMULATOR_ENABLED=true. */
export function simulatorEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SIMULATOR_ENABLED === "true";
}
