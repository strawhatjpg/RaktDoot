// Client-side types for API responses not defined in @raktdoot/shared contracts.
import type { ForecastResponse, UserRole } from "@raktdoot/shared";

export interface Me {
  id: string; name: string; role: UserRole; verified: boolean; district: string | null;
  hospitalId: string | null; language: string; isDonor: boolean;
}
export interface DemoAccount { id: string; label: string; description: string }
export interface CopilotDraft {
  id: string; kind: "DONOR_OUTREACH" | "DONATION_CAMPAIGN"; status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  requestId: string | null; district: string | null; bloodGroup: string; component: string;
  audience: string; message: string; rationale: string; createdAt: string; decidedAt: string | null;
}
export interface Briefing {
  district: string; generatedAt: string; isSynthetic: boolean;
  backtest: { modelMae: number; baselineMae: number; weeksTested: number };
  highRisk: ForecastResponse["points"]; openRequests: number; awaitingVerification: string[]; outreachActive: string[];
}
export interface Backtest {
  district: string; isSynthetic: boolean; modelMae: number; baselineMae: number; weeksTested: number;
  intervalCoverage: number; weekly: Array<{ weekStart: string; modelMae: number; baselineMae: number }>;
}
export interface CopilotAnswer { text: string; provider: string; toolsUsed: string[]; draftIds: string[]; drafts: CopilotDraft[] }
