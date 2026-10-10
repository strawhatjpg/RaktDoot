// Demo sign-in for seeded, simulated accounts only. Same guard as M2's demo-session CLI:
// DEMO_MODE=true and never in production. Real users sign in with WhatsApp.
import { demoModeEnabled, sessionResponse } from "../../../../server/auth/login.ts";
import { getDb } from "../../../../server/db.ts";
import { ApiError, apiError, json, readJson } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_ACCOUNTS = [
  { id: "demo-requester", label: "Family member", description: "Raise and track a blood request" },
  { id: "demo-donor-1", label: "Donor", description: "Consent, availability and location" },
  { id: "demo-coordinator", label: "Coordinator", description: "Briefing, forecast and Copilot" },
  { id: "demo-hospital-staff", label: "Hospital staff", description: "Verified hospital requests" },
] as const;

export async function GET(): Promise<Response> {
  return json({ enabled: demoModeEnabled(), accounts: demoModeEnabled() ? DEMO_ACCOUNTS : [] });
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!demoModeEnabled()) throw new ApiError(404, "NOT_FOUND", "Demo sign-in is disabled");
    const origin = request.headers.get("origin");
    const configured = process.env.APP_BASE_URL;
    if (!configured || origin !== new URL(configured).origin) throw new ApiError(403, "INVALID_ORIGIN", "A same-origin request is required");
    const body = (await readJson(request)) as { userId?: unknown } | null;
    const userId = typeof body?.userId === "string" ? body.userId : "";
    if (!DEMO_ACCOUNTS.some((a) => a.id === userId)) throw new ApiError(400, "VALIDATION_ERROR", "Choose a demo account");
    const user = await getDb().user.findUnique({ where: { id: userId } });
    if (!user?.isSimulated) throw new ApiError(404, "NOT_FOUND", "Seed the demo data first (npm run db:seed)");
    return sessionResponse(user.id, { ok: true });
  } catch (error) { return apiError(error); }
}
