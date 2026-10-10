import type { BloodGroup, ExtractedRequest, LanguageCode } from "@raktdoot/shared";

export const STEPS = [
  "NEW", "LANG", "TERMS", "ROLE",
  "INTAKE", "FOLLOW_UP", "CONFIRM",
  "CONSENT_ALERTS", "CONSENT_REMINDERS", "CONSENT_LOCATION", "DONOR_LOCATION", "DONOR_GROUP",
  "IDLE", "DECLINED",
] as const;
export type Step = (typeof STEPS)[number];

export type IntakeField = ExtractedRequest["missingFields"][number];

export interface ConversationState {
  step: Step;
  lang: LanguageCode;
  termsAccepted: boolean;
  consents: { alerts?: boolean; reminders?: boolean; location?: boolean };
  draft?: ExtractedRequest;
  lastAsked?: IntakeField;
  asked: Partial<Record<IntakeField, number>>;
  /** Fields the user could not answer (e.g. component "not sure", no deadline). */
  skipped: IntakeField[];
  /** Script the user typed in before choosing Hindi, to pick hi vs hi-Latn. */
  firstScript?: "latin" | "devanagari";
  /** First message, if it already described a blood need; reused after onboarding. */
  pendingText?: string;
  /** Which flow the user is in; decides whether "LOCATION" etc. resumes intake. */
  role?: "REQUESTER" | "DONOR";
  /** True once the donor has given a blood group (sign-up finished). */
  donorRegistered?: boolean;
  /** Step to return to after a one-off command (e.g. LOCATION during intake). */
  resumeStep?: Step;
  updatedAt: string;
}

export function newState(now: Date): ConversationState {
  return { step: "NEW", lang: "en", termsAccepted: false, consents: {}, asked: {}, skipped: [], updatedAt: now.toISOString() };
}

/** Drafts older than this are discarded so stale half-finished requests never get submitted. */
export const DRAFT_TTL_MS = 6 * 60 * 60 * 1000;