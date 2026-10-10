import { createHash, randomBytes } from "node:crypto";
import type { ActorContext } from "@raktdoot/shared";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";

export const SESSION_COOKIE = "raktdoot_session";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Server-only integration point: M1 calls this only after proving channel identity. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60_000);
  await getDb().session.create({ data: { userId, tokenHash: digest(token), expiresAt } });
  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function requireActor(request: Request): Promise<ActorContext> {
  const authorization = request.headers.get("authorization");
  if (authorization !== null && !authorization.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHENTICATED", "Unsupported authorization scheme");
  }
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : cookie;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue");
  if (!authorization && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const configured = process.env.APP_BASE_URL;
    if (!configured || request.headers.get("origin") !== new URL(configured).origin) {
      throw new ApiError(403, "INVALID_ORIGIN", "A same-origin request is required");
    }
  }
  const session = await getDb().session.findUnique({ where: { tokenHash: digest(token) }, include: { user: true } });
  if (!session || session.expiresAt.getTime() <= Date.now()) throw new ApiError(401, "UNAUTHENTICATED", "Session expired or invalid");
  const user = session.user;
  return { userId: user.id, role: user.role, verified: user.verifiedAt !== null, hospitalId: user.hospitalId, district: user.district };
}