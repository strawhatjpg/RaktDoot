// Owner: M1 (wiring) + M2 (core adapter). One bot instance per server process.
// The bot now runs on M2's Prisma-backed CoreApi: conversations, users, consents,
// requests, donor sign-up, locations and invite replies all hit the real database.
// Set BOT_CORE=mock to fall back to M1's in-memory mock (tests / offline demos).
import { createBotFromEnv, createMemoryLoginStore, parseWebhook, type LoginCodeStore } from "@raktdoot/bot";
import { createPrismaCoreApi, handleReferralMessage } from "./core-adapter.ts";

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

/**
 * Referral links open WhatsApp prefilled with "JOIN <code>". Called by the webhook
 * (after signature verification) and the simulator. The bot still receives the text
 * and starts onboarding as for any first message. Never throws.
 */
export async function recordReferral(phone: string, text: string | undefined): Promise<void> {
  if (process.env.BOT_CORE === "mock") return;
  try { await handleReferralMessage(phone, text); }
  catch (error) { console.error("[referral] attach failed", error instanceof Error ? error.name : "UnknownError"); }
}

export async function recordReferralsFromWebhook(rawBody: string): Promise<void> {
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return; }
  for (const m of parseWebhook(payload)) if (m.kind === "text") await recordReferral(m.from, m.text);
}

/** Simulator is a demo tool: on in development, opt-in elsewhere with SIMULATOR_ENABLED=true. */
export function simulatorEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SIMULATOR_ENABLED === "true";
}
