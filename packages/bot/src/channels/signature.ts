/** Verify Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the app secret). */
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(rawBody: string | Uint8Array, header: string | null | undefined, appSecret: string): boolean {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** GET handshake: returns the challenge to echo back, or null to respond 403. */
export function verifyHandshake(params: URLSearchParams, verifyToken: string): string | null {
  const ok = params.get("hub.mode") === "subscribe" && !!verifyToken && params.get("hub.verify_token") === verifyToken;
  return ok ? params.get("hub.challenge") : null;
}