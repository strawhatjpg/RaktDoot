/**
 * Framework-agnostic WhatsApp webhook handler. M2 wires it into Next.js:
 *   app/api/whatsapp/webhook/route.ts → GET: handleVerify(url)  POST: handleWebhook(rawBody, signature)
 * Always ACK fast with 200; dedupe Meta retries by message id.
 */
import type { OutboundMessage } from "@raktdoot/shared";
import { parseWebhook } from "./webhook-parser.ts";
import { verifyHandshake, verifySignature } from "./signature.ts";
import type { WhatsAppClient } from "./whatsapp-client.ts";
import { processInbound, type BotDeps } from "../conversation/bot-flow.ts";

export interface WebhookDeps {
  bot: BotDeps;
  client: WhatsAppClient;
  appSecret: string;
  verifyToken: string;
  /** Set false only for local testing without a signature. */
  requireSignature?: boolean;
  onError?: (err: unknown) => void;
}

const seen = new Map<string, number>();
const SEEN_TTL_MS = 60 * 60 * 1000;

function firstTime(id: string, now: number): boolean {
  for (const [k, ts] of seen) if (now - ts > SEEN_TTL_MS) seen.delete(k);
  if (seen.has(id)) return false;
  seen.set(id, now);
  return true;
}

export function handleVerify(url: URL, verifyToken: string): { status: number; body: string } {
  const challenge = verifyHandshake(url.searchParams, verifyToken);
  return challenge ? { status: 200, body: challenge } : { status: 403, body: "Forbidden" };
}

/** Returns the HTTP response immediately; message processing continues in `done`. */
export function handleWebhook(rawBody: string, signature: string | null, deps: WebhookDeps): { status: number; done: Promise<void> } {
  if (deps.requireSignature !== false && !verifySignature(rawBody, signature, deps.appSecret)) {
    return { status: 401, done: Promise.resolve() };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, done: Promise.resolve() };
  }
  const messages = parseWebhook(payload).filter((m) => firstTime(m.messageId, Date.now()));
  const done = (async () => {
    for (const m of messages) {
      try {
        void deps.client.markRead(m.messageId);
        const replies: OutboundMessage[] = await processInbound(m, deps.bot);
        for (const r of replies) await deps.client.sendMessage(r);
      } catch (err) {
        deps.onError?.(err);
      }
    }
  })();
  return { status: 200, done };
}