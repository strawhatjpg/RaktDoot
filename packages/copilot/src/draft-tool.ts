/** Logic behind the `draft_outreach_message` tool. Creates drafts only; never sends. */
import { z } from "zod";
import type { ApprovalStore } from "./approval.ts";
import type { CopilotDataSource } from "./data-source.ts";
import { bloodGroupSchema, districtSchema, forecastComponentSchema } from "./schemas.ts";
import { donationCampaignMessage, donorOutreachMessage } from "./templates.ts";

export const WAVE_1_SIZE = 5;

export const draftOutreachInputSchema = z.object({
  kind: z.enum(["DONOR_OUTREACH", "DONATION_CAMPAIGN"]),
  requestId: z.string().trim().min(1).max(40).optional(),
  district: districtSchema.optional(),
  bloodGroup: bloodGroupSchema.optional(),
  component: forecastComponentSchema.optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rationale: z.string().trim().min(1).max(500),
});
export type DraftOutreachInput = z.infer<typeof draftOutreachInputSchema>;

interface DraftDeps {
  data: CopilotDataSource;
  approvals: ApprovalStore;
}

export async function draftOutreach(deps: DraftDeps, input: DraftOutreachInput): Promise<Record<string, unknown>> {
  if (input.kind === "DONOR_OUTREACH") {
    if (!input.requestId) return { error: "DONOR_OUTREACH needs requestId" };
    const request = await deps.data.getRequest(input.requestId);
    if (!request) return { error: `Request ${input.requestId} not found` };
    const result = await deps.approvals.createDraft({
      kind: "DONOR_OUTREACH",
      requestId: request.id,
      district: null,
      bloodGroup: request.bloodGroup,
      component: request.component,
      audience: `Wave 1: top ${WAVE_1_SIZE} ranked donors with URGENT_ALERTS consent`,
      message: donorOutreachMessage({
        requestId: request.id,
        bloodGroup: request.bloodGroup,
        component: request.component,
        units: request.units,
        hospitalName: request.hospitalName,
      }),
      rationale: input.rationale,
    });
    return result.ok ? pending(result.draft) : { error: result.reason };
  }

  if (!input.district || !input.bloodGroup || !input.component || !input.weekStart) {
    return { error: "DONATION_CAMPAIGN needs district, bloodGroup, component and weekStart" };
  }
  const result = await deps.approvals.createDraft({
    kind: "DONATION_CAMPAIGN",
    requestId: null,
    district: input.district,
    bloodGroup: input.bloodGroup,
    component: input.component,
    audience: `Opted-in ${input.bloodGroup} donors in ${input.district} past their provisional donation interval`,
    message: donationCampaignMessage({
      district: input.district,
      bloodGroup: input.bloodGroup,
      component: input.component,
      weekStart: input.weekStart,
    }),
    rationale: input.rationale,
  });
  return result.ok ? pending(result.draft) : { error: result.reason };
}

function pending(draft: { id: string; kind: string; audience: string; message: string }): Record<string, unknown> {
  return {
    draftId: draft.id,
    status: "PENDING_APPROVAL",
    kind: draft.kind,
    audience: draft.audience,
    message: draft.message,
    note: "Nothing has been sent. A coordinator must approve this draft.",
  };
}
