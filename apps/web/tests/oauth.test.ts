// Google OAuth: PKCE + state, profile linking, and the routes' failure handling.
// Google itself is faked (no network). The real redirect is verified manually.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { getDb } from "../src/server/db.ts";
import { exchangeGoogleCode, findOrCreateOAuthUser, readOAuthCookie, startGoogleLogin, statesMatch } from "../src/server/auth/oauth.ts";
import { GET as start } from "../src/app/api/auth/google/start/route.ts";
import { GET as callback } from "../src/app/api/auth/google/callback/route.ts";
import { GET as me } from "../src/app/api/auth/session/route.ts";

const db = getDb();
after(async () => { await db.$disconnect(); });
const config = { clientId: "cid", clientSecret: "secret", redirectUri: "http://localhost:3000/api/auth/google/callback" };

test("start builds a PKCE S256 request bound to an HttpOnly state cookie", () => {
  const { url, cookie } = startGoogleLogin(config, "/request");
  const u = new URL(url);
  assert.equal(u.origin, "https://accounts.google.com");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("scope"), "openid email profile");
  assert.match(cookie, /HttpOnly; SameSite=Lax/);
  const saved = readOAuthCookie(cookie.split(";")[0]!)!;
  assert.equal(saved.state, u.searchParams.get("state"));
  assert.equal(saved.returnTo, "/request");
  assert.equal(createHash("sha256").update(saved.verifier).digest("base64url"), u.searchParams.get("code_challenge"));
  assert.equal(readOAuthCookie(startGoogleLogin(config, "//evil.example").cookie.split(";")[0]!)!.returnTo, "/", "open redirect blocked");
  assert.equal(statesMatch("a", "b"), false);
});

test("code exchange sends the verifier and returns the OIDC profile; failures throw", async () => {
  let sentVerifier = "";
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("token")) { sentVerifier = new URLSearchParams(String(init?.body)).get("code_verifier") ?? ""; return Response.json({ access_token: "at" }); }
    return Response.json({ sub: "g-123", email: "Asha@Example.com", email_verified: true, name: "Asha Patil" });
  }) as typeof fetch;
  const profile = await exchangeGoogleCode(config, "code", "v".repeat(64), fakeFetch);
  assert.equal(sentVerifier, "v".repeat(64));
  assert.deepEqual(profile, { sub: "g-123", email: "Asha@Example.com", emailVerified: true, name: "Asha Patil" });
  const denied = (async () => Response.json({ error: "invalid_grant" }, { status: 400 })) as typeof fetch;
  await assert.rejects(exchangeGoogleCode(config, "bad", "v", denied));
});

test("users are linked by Google subject, then by verified email; never granted staff roles", async () => {
  const a = await findOrCreateOAuthUser("google", { sub: "g-1", email: "Donor@Example.com", emailVerified: true, name: "Donor One" });
  const again = await findOrCreateOAuthUser("google", { sub: "g-1", email: "changed@example.com", emailVerified: true, name: "X" });
  assert.equal(again.id, a.id);
  const user = await db.user.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(user.role, "REQUESTER");
  assert.equal(user.email, "donor@example.com");
  const unverified = await findOrCreateOAuthUser("google", { sub: "g-2", email: "donor@example.com", emailVerified: false, name: "Impostor" });
  assert.notEqual(unverified.id, a.id, "an unverified email never takes over an account");
});

test("routes: start needs config; callback rejects missing or mismatched state", async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  assert.equal((await start(new Request("http://localhost:3000/api/auth/google/start"))).status, 503);
  process.env.GOOGLE_CLIENT_ID = "cid"; process.env.GOOGLE_CLIENT_SECRET = "secret";
  const started = start(new Request("http://localhost:3000/api/auth/google/start?returnTo=/request"));
  assert.equal(started.status, 302);
  const cookie = started.headers.get("set-cookie")!.split(";")[0]!;
  const bad = await callback(new Request("http://localhost:3000/api/auth/google/callback?code=c&state=wrong", { headers: { cookie } }));
  assert.equal(bad.status, 302);
  assert.match(bad.headers.get("location")!, /\/login\?error=oauth$/);
  const noCookie = await callback(new Request("http://localhost:3000/api/auth/google/callback?code=c&state=x"));
  assert.match(noCookie.headers.get("location")!, /error=oauth/);
  const anon = await (await me(new Request("http://localhost:3000/api/auth/session"))).json();
  assert.equal(anon.signedIn, false);
  assert.equal(anon.methods.google, true);
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
});