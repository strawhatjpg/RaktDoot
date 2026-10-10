// Owner: M1. Meta WhatsApp Cloud API webhook.
// GET  → subscription handshake (hub.verify_token).  POST → signed message events.
import { after } from "next/server";
import { handleVerify, handleWebhook } from "@raktdoot/bot";
import { getBot } from "../../../../server/bot/index.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const result = handleVerify(new URL(request.url), process.env.WHATSAPP_VERIFY_TOKEN ?? "");
  return new Response(result.body, { status: result.status, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request): Promise<Response> {
  const { bot, client } = getBot();
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  if (!client || !appSecret) {
    return new Response("WhatsApp is not configured", { status: 503 });
  }
  const raw = await request.text();
  if (raw.length > 256_000) return new Response(null, { status: 413 });
  const result = handleWebhook(raw, request.headers.get("x-hub-signature-256"), {
    bot,
    client,
    appSecret,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    // Never log message bodies or phone numbers.
    onError: (err) => console.error("[whatsapp] processing failed", err instanceof Error ? err.name : "UnknownError"),
  });
  // Reply 200 to Meta immediately; process and send replies after the response.
  after(result.done);
  return new Response(null, { status: result.status });
}
