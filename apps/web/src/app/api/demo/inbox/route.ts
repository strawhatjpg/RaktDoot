/**
 * Demo inbox (development / DEMO_MODE only): the WhatsApp messages the system
 * queued or sent, newest first, so the demo shows exactly what donors received —
 * including messages to fictional seeded donors that are never really sent.
 */
import { getDb } from "../../../../server/db.ts";
import { ApiError, apiError, json } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    if (process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production") throw new ApiError(404, "NOT_FOUND", "Not found");
    const phone = new URL(request.url).searchParams.get("phone");
    const rows = await getDb().notification.findMany({
      where: phone ? { toPhone: phone } : {}, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      include: { user: { select: { name: true, isSimulated: true } } },
    });
    return json({
      messages: rows.map((r) => ({
        id: r.id, to: r.toPhone, recipient: r.user?.name ?? null, fictional: r.user?.isSimulated ?? false,
        purpose: r.purpose, status: r.status, createdAt: r.createdAt.toISOString(), message: JSON.parse(r.payload) as unknown,
      })),
    });
  } catch (error) { return apiError(error); }
}