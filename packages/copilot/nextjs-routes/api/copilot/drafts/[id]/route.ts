// apps/web/src/app/api/copilot/drafts/[id]/route.ts
// The ONLY way a Copilot draft can lead to a message: explicit coordinator approval.
import { isApproverRole } from "@raktdoot/copilot";
import { z } from "zod";
import { approvals, getStaffRole } from "@/server/copilot";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("reject"), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("edit"), message: z.string().min(1).max(1000) }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = getStaffRole(request);
  if (!role || !isApproverRole(role)) return Response.json({ error: "Coordinators only" }, { status: 403 });
  const { id } = await context.params;
  if (!approvals.get(id)) return Response.json({ error: "Draft not found" }, { status: 404 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });

  const result =
    body.data.action === "approve"
      ? await approvals.approve(id, role, body.data.note)
      : body.data.action === "reject"
        ? approvals.reject(id, role, body.data.note)
        : approvals.editMessage(id, body.data.message, role);

  return result.ok ? Response.json({ draft: result.draft }) : Response.json({ error: result.reason }, { status: 409 });
}
