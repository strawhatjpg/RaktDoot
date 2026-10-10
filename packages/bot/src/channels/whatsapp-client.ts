/**
 * WhatsApp Cloud API client: OutboundMessage → Graph API payload, send, and media download.
 * Free-window rule: text/buttons only within 24 h of the user's last message; outside it,
 * only approved templates (those are paid — prefer app push for reminders).
 */
import type { OutboundMessage } from "@raktdoot/shared";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): WhatsAppConfig | null {
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) return null;
  return {
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    apiVersion: env.WHATSAPP_API_VERSION || "v25.0",
  };
}

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

/** Build the Graph API JSON body. Pure function, unit tested. */
export function toGraphPayload(msg: OutboundMessage): Record<string, unknown> {
  const to = msg.to.replace(/\D/g, "");
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  switch (msg.kind) {
    case "buttons": {
      const buttons = (msg.buttons ?? []).slice(0, 3).map((b) => ({
        type: "reply",
        reply: { id: truncate(b.id, 256), title: truncate(b.title, 20) },
      }));
      if (buttons.length === 0) return { ...base, type: "text", text: { body: truncate(msg.text, 4096) } };
      return { ...base, type: "interactive", interactive: { type: "button", body: { text: truncate(msg.text, 1024) }, action: { buttons } } };
    }
    case "location_request":
      return {
        ...base,
        type: "interactive",
        interactive: { type: "location_request_message", body: { text: truncate(msg.text, 1024) }, action: { name: "send_location" } },
      };
    case "template":
      return {
        ...base,
        type: "template",
        template: {
          name: msg.templateName,
          language: { code: "en" },
          components: msg.templateParams?.length
            ? [{ type: "body", parameters: msg.templateParams.map((text) => ({ type: "text", text })) }]
            : [],
        },
      };
    default:
      return { ...base, type: "text", text: { body: truncate(msg.text, 4096), preview_url: true } };
  }
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export function createWhatsAppClient(config: WhatsAppConfig, fetchFn: typeof fetch = fetch) {
  const graph = `https://graph.facebook.com/${config.apiVersion ?? "v25.0"}`;
  const auth = { Authorization: `Bearer ${config.accessToken}` };

  async function sendMessage(msg: OutboundMessage): Promise<SendResult> {
    try {
      const res = await fetchFn(`${graph}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(toGraphPayload(msg)),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
      if (!res.ok) return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
      const id = data.messages?.[0]?.id;
      return id ? { ok: true, messageId: id } : { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Two-step media download: GET /{media-id} → url, then GET url with the same token. */
  async function downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
    const meta = await fetchFn(`${graph}/${encodeURIComponent(mediaId)}`, { headers: auth });
    if (!meta.ok) throw new Error(`Media lookup failed: HTTP ${meta.status}`);
    const info = (await meta.json()) as { url?: string; mime_type?: string };
    if (!info.url) throw new Error("Media URL missing");
    const file = await fetchFn(info.url, { headers: auth });
    if (!file.ok) throw new Error(`Media download failed: HTTP ${file.status}`);
    return { bytes: new Uint8Array(await file.arrayBuffer()), mimeType: info.mime_type ?? "audio/ogg" };
  }

  /** Shows a blue tick + typing indicator while the AI works. Best-effort. */
  async function markRead(messageId: string): Promise<void> {
    await fetchFn(`${graph}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } }),
    }).catch(() => undefined);
  }

  return { sendMessage, downloadMedia, markRead };
}

export type WhatsAppClient = ReturnType<typeof createWhatsAppClient>;