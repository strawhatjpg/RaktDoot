/**
 * "Sign in with Google" — OAuth 2.0 authorization-code flow with PKCE (RFC 7636)
 * and a `state` value bound to an HttpOnly cookie (CSRF protection).
 * Identity = Google's stable `sub`. Only a verified email is linked to an account.
 * New users are always REQUESTER: staff roles are never granted by OAuth.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";

export const OAUTH_COOKIE = "raktdoot_oauth";
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

export interface OAuthConfig { clientId: string; clientSecret: string; redirectUri: string }

export function googleConfig(env: Record<string, string | undefined> = process.env): OAuthConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.APP_BASE_URL) return null;
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: new URL("/api/auth/google/callback", env.APP_BASE_URL).toString() };
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Returns the Google URL to redirect to and the cookie value that binds this browser. */
export function startGoogleLogin(config: OAuthConfig, returnTo = "/"): { url: string; cookie: string } {
  const state = b64url(randomBytes(32));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo.slice(0, 200) : "/";
  const url = new URL(GOOGLE_AUTH);
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: "openid email profile",
    state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  const value = b64url(Buffer.from(JSON.stringify({ state, verifier, returnTo: safeReturn })));
  const cookie = `${OAUTH_COOKIE}=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  return { url: url.toString(), cookie };
}

export function clearOAuthCookie(): string {
  return `${OAUTH_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readOAuthCookie(cookieHeader: string | null): { state: string; verifier: string; returnTo: string } | null {
  const raw = cookieHeader?.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${OAUTH_COOKIE}=`))?.slice(OAUTH_COOKIE.length + 1);
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof v.state === "string" && typeof v.verifier === "string" && typeof v.returnTo === "string" ? { state: v.state, verifier: v.verifier, returnTo: v.returnTo } : null;
  } catch { return null; }
}

export function statesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface GoogleProfile { sub: string; email: string | null; emailVerified: boolean; name: string }

/** Exchanges the code (with the PKCE verifier) and fetches the OIDC profile. */
export async function exchangeGoogleCode(config: OAuthConfig, code: string, verifier: string, fetchFn: typeof fetch = fetch): Promise<GoogleProfile> {
  const tokenRes = await fetchFn(GOOGLE_TOKEN, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
    signal: AbortSignal.timeout(10_000),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!tokenRes.ok || !token.access_token) throw new ApiError(401, "OAUTH_FAILED", "Google sign-in could not be completed");
  const infoRes = await fetchFn(GOOGLE_USERINFO, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10_000) });
  const info = (await infoRes.json().catch(() => ({}))) as { sub?: string; email?: string; email_verified?: boolean; name?: string; given_name?: string };
  if (!infoRes.ok || !info.sub) throw new ApiError(401, "OAUTH_FAILED", "Google profile unavailable");
  return { sub: info.sub, email: info.email ?? null, emailVerified: info.email_verified === true, name: (info.name ?? info.given_name ?? "RaktDoot user").slice(0, 80) };
}

/** Links by provider subject first; then by verified email; otherwise creates a REQUESTER. */
export async function findOrCreateOAuthUser(provider: "google", profile: GoogleProfile): Promise<{ id: string }> {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const linked = await tx.oAuthAccount.findUnique({ where: { provider_subject: { provider, subject: profile.sub } }, select: { userId: true } });
    if (linked) return { id: linked.userId };
    const email = profile.emailVerified && profile.email ? profile.email.toLowerCase() : null;
    const existing = email ? await tx.user.findUnique({ where: { email }, select: { id: true } }) : null;
    const user = existing ?? await tx.user.create({ data: { name: profile.name, email, role: "REQUESTER" }, select: { id: true } });
    await tx.oAuthAccount.create({ data: { provider, subject: profile.sub, userId: user.id } });
    await tx.auditLog.create({ data: { actorId: user.id, action: existing ? "OAUTH_LINKED" : "OAUTH_SIGNUP", entity: "User", entityId: user.id } });
    return user;
  });
}