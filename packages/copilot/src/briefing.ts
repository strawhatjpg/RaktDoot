/**
 * Daily shortage briefing. Facts are computed deterministically from tools'
 * data (no LLM). The Copilot can then phrase it in the coordinator's language.
 */
import type { ForecastPoint } from "@raktdoot/shared";
import type { CopilotDataSource } from "./data-source.ts";
import type { ForecastClient } from "./forecast-client.ts";

export const HIGH_RISK_THRESHOLD = 0.7;
/** Ignore tiny series (e.g. 1-5 units of a rare group): their risk is mostly noise. */
export const MIN_MEDIAN_DEMAND = 10;

export interface ShortageBriefing {
  district: string;
  generatedAt: string;
  isSynthetic: boolean;
  backtest: { modelMae: number; baselineMae: number; weeksTested: number };
  highRisk: ForecastPoint[];
  openRequests: number;
  awaitingVerification: string[];
  outreachActive: string[];
}

export async function buildShortageBriefing(
  deps: { data: CopilotDataSource; forecast: ForecastClient },
  district: string,
  options: { horizonWeeks?: number; threshold?: number; minMedianDemand?: number; limit?: number } = {},
): Promise<ShortageBriefing> {
  const threshold = options.threshold ?? HIGH_RISK_THRESHOLD;
  const minDemand = options.minMedianDemand ?? MIN_MEDIAN_DEMAND;
  const [forecast, requests] = await Promise.all([
    deps.forecast.forecast({ district, horizonWeeks: options.horizonWeeks ?? 2 }),
    deps.data.getOpenRequests(),
  ]);
  const highRisk = forecast.points
    .filter((p) => p.shortageRisk >= threshold && p.p50 >= minDemand)
    .sort((a, b) => b.shortageRisk - a.shortageRisk)
    .slice(0, options.limit ?? 5);
  return {
    district: forecast.district,
    generatedAt: forecast.generatedAt,
    isSynthetic: forecast.isSynthetic,
    backtest: forecast.backtest,
    highRisk,
    openRequests: requests.length,
    awaitingVerification: requests.filter((r) => r.verification === "PENDING_REVIEW").map((r) => r.id),
    outreachActive: requests.filter((r) => r.status === "OUTREACH_ACTIVE").map((r) => r.id),
  };
}

const COMPONENT_TEXT: Record<string, string> = {
  WHOLE_BLOOD: "whole blood",
  PACKED_RED_CELLS: "red cells",
  PLATELETS: "platelets",
  PLASMA: "plasma",
};

/** Plain-English rendering (used by the CLI and as a no-LLM fallback in the UI). */
export function formatBriefing(b: ShortageBriefing): string {
  const lines = [
    `Shortage briefing: ${b.district}${b.isSynthetic ? " (synthetic data)" : ""}`,
    `Model error ${b.backtest.modelMae} vs baseline ${b.backtest.baselineMae} units over ${b.backtest.weeksTested} weeks.`,
  ];
  if (b.highRisk.length === 0) {
    lines.push("No group/component above the high-risk threshold.");
  } else {
    lines.push("Highest shortage risk:");
    for (const p of b.highRisk) {
      lines.push(
        `- ${p.weekStart} ${p.bloodGroup} ${COMPONENT_TEXT[p.component] ?? p.component}: risk ${Math.round(p.shortageRisk * 100)}%, ` +
          `demand ${Math.round(p.p10)}-${Math.round(p.p90)} (median ${Math.round(p.p50)}) vs supply ~${Math.round(p.expectedSupply)}. ` +
          (p.drivers[0] ?? ""),
      );
    }
  }
  lines.push(
    `Open requests: ${b.openRequests}; awaiting verification: ${b.awaitingVerification.join(", ") || "none"}; outreach active: ${b.outreachActive.join(", ") || "none"}.`,
  );
  return lines.join("\n");
}
