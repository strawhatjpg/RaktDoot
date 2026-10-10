/**
 * Demo sign-in (development only): sign in as a seeded FICTIONAL account so the
 * staff side of the demo works without real staff accounts. Refused in production
 * and unless DEMO_MODE=true. Only isSimulated users can be chosen.
 */
import { createSession, sessionCookie } from "../../../../server/auth/session.ts";
import { getDb } from "../../../../server/db.ts";
import { ApiError, apiError, json, readJson } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_ACCOUNTS = [
  { id: "demo-requester", label: "Family member", description: "Raise and track a blood request" },
  { id: "demo-donor-1", label: "Donor", description: "Consent, availability and location" },
  { id: "demo-coordinator", label: "Coordinator", description: "Briefing, forecast and Copilot" },
  { id: "demo-hospital-staff", label: "Hospital staff", description: "Verified hospital requests" },
  { id: "demo-centre-staff", label: "Blood centre staff", description: "Blood centre staff demo" },
] as const;

export async function GET(): Promise<Response> {
  const enabled = process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
  return json({ enabled, accounts: enabled ? DEMO_ACCOUNTS : [] });
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production") throw new ApiError(404, "NOT_FOUND", "Not found");
    const origin = request.headers.get("origin");
    if (!process.env.APP_BASE_URL || origin !== new URL(process.env.APP_BASE_URL).origin) throw new ApiError(403, "INVALID_ORIGIN", "A same-origin request is required");
    const userId = (await readJson(request) as { userId?: unknown } | null)?.userId;
    if (typeof userId !== "string" || !DEMO_ACCOUNTS.some((account) => account.id === userId)) throw new ApiError(400, "VALIDATION_ERROR", "Choose a demo account");
    const user = await getDb().user.findUnique({ where: { id: userId } });
    if (!user?.isSimulated) throw new ApiError(404, "NOT_FOUND", "Run the demo seed first");
    const session = await createSession(user.id);
    return new Response(JSON.stringify({ signedIn: true }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": sessionCookie(session.token, session.expiresAt) } });
  } catch (error) { return apiError(error); }
}