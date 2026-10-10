/**
 * Parse a WhatsApp Cloud API "messages" webhook into InboundMessage[] (shared contract).
 * Status callbacks (sent/delivered/read) and unsupported types are ignored safely.
 */
import type { InboundMessage } from "@raktdoot/shared";

interface WaMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  audio?: { id?: string; mime_type?: string };
  voice?: { id?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  interactive?: { type?: string; button_reply?: { id?: string }; list_reply?: { id?: string } };
  button?: { payload?: string; text?: string };
}

export function toE164(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export function parseWebhook(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const p = payload as { object?: string; entry?: Array<{ changes?: Array<{ field?: string; value?: { messages?: WaMessage[] } }> }> };
  if (!p || p.object !== "whatsapp_business_account" || !Array.isArray(p.entry)) return out;

  for (const entry of p.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const m of change.value?.messages ?? []) {
        if (!m.from || !m.id) continue;
        const ts = Number(m.timestamp);
        const base = {
          channel: "WHATSAPP" as const,
          from: toE164(m.from),
          messageId: m.id,
          receivedAt: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
        };
        switch (m.type) {
          case "text":
            if (m.text?.body) out.push({ ...base, kind: "text", text: m.text.body.slice(0, 2000) });
            break;
          case "audio":
          case "voice": {
            const id = m.audio?.id ?? m.voice?.id;
            if (id) out.push({ ...base, kind: "audio", audioMediaId: id });
            break;
          }
          case "location": {
            const lat = Number(m.location?.latitude);
            const lng = Number(m.location?.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              const label = m.location?.name ?? m.location?.address;
              out.push({ ...base, kind: "location", location: label ? { lat, lng, label } : { lat, lng } });
            }
            break;
          }
          case "interactive": {
            const id = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id;
            if (id) out.push({ ...base, kind: "button", buttonId: id });
            break;
          }
          case "button": // quick-reply button on a template message
            if (m.button?.payload) out.push({ ...base, kind: "button", buttonId: m.button.payload });
            break;
          default:
            break; // images, stickers, etc. are not supported
        }
      }
    }
  }
  return out;
}