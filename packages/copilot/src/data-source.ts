/**
 * Read-only data the Copilot needs. Member 2 implements this against the DB/APIs;
 * until then `createMockDataSource` (mock-data.ts) provides simulated demo data.
 */
import type {
  BloodRequestDTO,
  CentreResultDTO,
  MatchCandidateDTO,
  UserRole,
  VerificationStatus,
} from "@raktdoot/shared";

/** One entry in a request's timeline (status change, verification, donor reply...). */
export interface CaseEventDTO {
  at: string; // ISO timestamp
  kind: string; // e.g. "STATUS_CHANGED", "VERIFIED", "DONOR_ACCEPTED"
  summary: string; // short, non-identifying description
  actorRole?: UserRole;
}

export interface CopilotDataSource {
  /** All requests that are not CLOSED. */
  getOpenRequests(): Promise<BloodRequestDTO[]>;
  getRequest(requestId: string): Promise<BloodRequestDTO | null>;
  /** Licensed centres near the treating hospital, nearest first. */
  searchCentres(requestId: string): Promise<CentreResultDTO[]>;
  /** Explained ranking (docs/PIPELINES.md § B). Callers must check verification first. */
  rankDonors(requestId: string, limit: number): Promise<MatchCandidateDTO[]>;
  getCaseEvents(requestId: string): Promise<CaseEventDTO[]>;
}

/** Convenience for the approval store's re-check at approval time. */
export async function getVerification(
  data: CopilotDataSource,
  requestId: string,
): Promise<VerificationStatus | null> {
  const request = await data.getRequest(requestId);
  return request?.verification ?? null;
}
