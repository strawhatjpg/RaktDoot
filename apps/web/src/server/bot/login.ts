// Owner: M1. Binds a WhatsApp login code to the browser that requested it.
// Without this, anyone guessing a confirmed 6-digit code within 5 minutes could
// claim the session. The browser holds a random secret in an HttpOnly cookie;
// only its hash is kept server-side.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const LOGIN_COOKIE = "raktdoot_login";
const TTL_MS = 5 * 60 * 1000;

const digest = (v: string) => createHash("sha256").update(v).digest();
const globalPending = globalThis as unknown as { raktdootPendingLogins?: Map<string, { hash: Buffer; expiresAt: number }> };

function pending(): Map<string, { hash: Buffer; expiresAt: number }> {
  globalPending.raktdootPendingLogins ??= new Map();
  const map = globalPending.raktdootPendingLogins;
  const now = Date.now();
  for (const [code, entry] of map) if (entry.expiresAt <= now) map.delete(code);
  return map;
}

/** Returns the browser secret to set as a cookie. */
export function bindCode(code: string): string {
  const secret = randomBytes(32).toString("base64url");
  pending().set(code, { hash: digest(secret), expiresAt: Date.now() + TTL_MS });
  return secret;
}

export function ownsCode(code: string, secret: string | undefined): boolean {
  const entry = pending().get(code);
  if (!entry || !secret) return false;
  const given = digest(secret);
  return given.length === entry.hash.length && timingSafeEqual(given, entry.hash);
}

export function releaseCode(code: string): void {
  pending().delete(code);
}

export function readCookie(request: Request, name: string): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function loginCookie(secret: string, maxAgeSeconds: number): string {
  return `${LOGIN_COOKIE}=${secret}; Path=/api/auth/whatsapp; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
