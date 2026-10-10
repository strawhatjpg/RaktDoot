/**
 * Copilot tools (docs/PIPELINES.md § F). Every tool is READ-ONLY or creates a
 * PENDING draft. There is deliberately no tool that sends, closes or edits:
 * those actions exist only behind ApprovalStore.approve() / staff UI.
 */
import { canStartDonorOutreach } from "@raktdoot/shared";
import { z } from "zod";
import { defineTool, type ToolDeps } from "./define-tool.ts";
import { draftOutreach, draftOutreachInputSchema } from "./draft-tool.ts";
import { bloodGroupSchema, districtSchema, forecastComponentSchema } from "./schemas.ts";

export type { ToolDeps } from "./define-tool.ts";

export const MAX_DONORS = 10;
const MAX_FORECAST_POINTS = 8;

export const COPILOT_TOOL_NAMES = [
  "get_open_requests",
  "search_blood_centres",
  "rank_donors",
  "get_forecast",
  "summarize_case",
  "draft_outreach_message",
] as const;

const requestIdSchema = z.object({ requestId: z.string().trim().min(1).max(40) });

export function createCopilotTools(deps: ToolDeps) {
  const { data, forecast } = deps;

  const getOpenRequests = defineTool(
    deps,
    "get_open_requests",
    "List all open (not closed) blood requests with status, verification, blood group, component, units and deadline.",
    z.object({}),
    async () => {
      const requests = await data.getOpenRequests();
      return { count: requests.length, requests };
    },
  );

  const searchBloodCentres = defineTool(
    deps,
    "search_blood_centres",
    "Licensed blood centres near the treating hospital of a request, nearest first, with stock status (REPORTED/CONFIRMED/RESERVED), update time and whether stock is simulated.",
    requestIdSchema,
    async ({ requestId }) => {
      const centres = await data.searchCentres(requestId);
      if (centres.length === 0) return { error: `No centres found for ${requestId}` };
      return { requestId, centres, note: "Stock marked isSimulated is demo data, not real availability." };
    },
  );

  const rankDonors = defineTool(
    deps,
    "rank_donors",
    `Explained donor ranking for a VERIFIED request (first names only, no phone numbers). Max ${MAX_DONORS}. Refuses unverified requests.`,
    requestIdSchema.extend({ limit: z.number().int().min(1).max(MAX_DONORS).default(5) }),
    async ({ requestId, limit }) => {
      const request = await data.getRequest(requestId);
      if (!request) return { error: `Request ${requestId} not found` };
      if (!canStartDonorOutreach(request.verification)) {
        return { error: `Request ${requestId} is ${request.verification}. Donors can be ranked only after staff verify it.` };
      }
      return { requestId, donors: await data.rankDonors(requestId, limit) };
    },
  );

  const getForecast = defineTool(
    deps,
    "get_forecast",
    "Weekly demand forecast for a district (1-4 weeks): P10/P50/P90 range, expected supply, shortage risk 0-1 and drivers. Returns the highest-risk points first. Data is synthetic.",
    z.object({
      district: districtSchema,
      horizonWeeks: z.number().int().min(1).max(4).default(4),
      bloodGroups: z.array(bloodGroupSchema).min(1).optional(),
      components: z.array(forecastComponentSchema).min(1).optional(),
    }),
    async (query) => {
      const result = await forecast.forecast(query);
      const top = [...result.points].sort((a, b) => b.shortageRisk - a.shortageRisk).slice(0, MAX_FORECAST_POINTS);
      return {
        district: result.district,
        isSynthetic: result.isSynthetic,
        label: result.isSynthetic ? "Demonstrated on synthetic data" : "Forecast",
        backtest: result.backtest,
        totalPoints: result.points.length,
        highestRiskPoints: top,
      };
    },
  );

  const summarizeCase = defineTool(
    deps,
    "summarize_case",
    "Facts for one request: details, timeline, nearby centres with stock and whether donor outreach is allowed. Use this before summarising a case.",
    requestIdSchema,
    async ({ requestId }) => {
      const request = await data.getRequest(requestId);
      if (!request) return { error: `Request ${requestId} not found` };
      const [events, centres] = await Promise.all([data.getCaseEvents(requestId), data.searchCentres(requestId)]);
      const confirmed = centres
        .filter((c) => c.stock?.status === "CONFIRMED")
        .reduce((n, c) => n + (c.stock?.units ?? 0), 0);
      return {
        request,
        timeline: events,
        centresListed: centres.length,
        confirmedStockUnits: confirmed,
        donorOutreachAllowed: canStartDonorOutreach(request.verification),
      };
    },
  );

  const draftOutreachMessage = defineTool(
    deps,
    "draft_outreach_message",
    "Create a DRAFT message for coordinator approval. kind=DONOR_OUTREACH needs a verified requestId; kind=DONATION_CAMPAIGN needs district, bloodGroup, component and weekStart (from get_forecast). Text comes from reviewed templates. Nothing is sent.",
    draftOutreachInputSchema,
    (input) => draftOutreach(deps, input),
  );

  return [getOpenRequests, searchBloodCentres, rankDonors, getForecast, summarizeCase, draftOutreachMessage];
}
