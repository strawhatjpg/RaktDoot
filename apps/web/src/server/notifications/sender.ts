/**
 * Real WhatsApp sender, built from M1's Graph API client. Null when WhatsApp is not
 * configured, in which case the outbox records messages as SIMULATED (demo inbox).
 */
import { configFromEnv, createWhatsAppClient } from "@raktdoot/bot";
import type { Sender } from "./outbox.ts";
import { dispatchPending } from "./outbox.ts";

export function whatsappSender(env: Record<string, string | undefined> = process.env): Sender | null {
  if (env.WHATSAPP_DELIVERY === "simulate") return null;
  const config = configFromEnv(env);
  if (!config) return null;
  const client = createWhatsAppClient(config);
  return (message) => client.sendMessage(message);
}

/** Best-effort immediate delivery after a commit; the worker retries anything left. */
export async function flushOutbox(): Promise<void> {
  try {
    await dispatchPending(whatsappSender());
  } catch (error) {
    console.error("[outbox] dispatch failed", error instanceof Error ? error.name : "UnknownError");
  }
}