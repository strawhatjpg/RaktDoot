/**
 * "Log in with WhatsApp": the app shows a 6-digit code and a wa.me link that pre-fills
 * "LOGIN 482913". When the bot receives it, the code is bound to the sender's verified
 * WhatsApp number. The app polls the code status and creates a session (M2 owns sessions).
 * Codes: single use, 5-minute expiry, cryptographically random.
 */
import { randomInt } from "node:crypto";

export const LOGIN_CODE_TTL_MS = 5 * 60 * 1000;
const LOGIN_RE = /^\s*login\s+(\d{6})\s*$/i;

export interface LoginCodeRecord {
  code: string;
  createdAt: number;
  phone: string | null; // set when confirmed via WhatsApp
  consumed: boolean;
}

export interface LoginCodeStore {
  get(code: string): Promise<LoginCodeRecord | null>;
  put(record: LoginCodeRecord): Promise<void>;
}

export function createMemoryLoginStore(): LoginCodeStore {
  const map = new Map<string, LoginCodeRecord>();
  return {
    async get(code) { return map.get(code) ?? null; },
    async put(record) { map.set(record.code, { ...record }); },
  };
}

export function parseLoginCommand(text: string | undefined): string | null {
  const m = text ? LOGIN_RE.exec(text) : null;
  return m ? m[1]! : null;
}

export function loginLink(botNumber: string, code: string): string {
  return `https://wa.me/${botNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`LOGIN ${code}`)}`;
}

export function createWhatsAppLogin(store: LoginCodeStore, now: () => number = Date.now) {
  const expired = (r: LoginCodeRecord) => now() - r.createdAt > LOGIN_CODE_TTL_MS;

  return {
    /** Called by the app's /api/auth/whatsapp/start. */
    async start(botNumber: string): Promise<{ code: string; link: string; expiresAt: string }> {
      let code = "";
      for (let i = 0; i < 5; i++) {
        code = String(randomInt(0, 1_000_000)).padStart(6, "0");
        const existing = await store.get(code);
        if (!existing || expired(existing)) break;
      }
      const createdAt = now();
      await store.put({ code, createdAt, phone: null, consumed: false });
      return { code, link: loginLink(botNumber, code), expiresAt: new Date(createdAt + LOGIN_CODE_TTL_MS).toISOString() };
    },

    /** Called by the bot when "LOGIN 123456" arrives. Phone comes from WhatsApp, so it is verified. */
    async confirm(code: string, phone: string): Promise<boolean> {
      const rec = await store.get(code);
      if (!rec || rec.consumed || rec.phone || expired(rec)) return false;
      await store.put({ ...rec, phone });
      return true;
    },

    /** Called by the app while polling. Returns the phone exactly once, then the code is dead. */
    async poll(code: string): Promise<{ status: "pending" | "confirmed" | "expired"; phone?: string }> {
      const rec = await store.get(code);
      if (!rec || rec.consumed || expired(rec)) return { status: "expired" };
      if (!rec.phone) return { status: "pending" };
      await store.put({ ...rec, consumed: true });
      return { status: "confirmed", phone: rec.phone };
    },
  };
}

export type WhatsAppLogin = ReturnType<typeof createWhatsAppLogin>;