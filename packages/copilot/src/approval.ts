/**
 * Human-in-the-loop approval for Copilot drafts.
 *
 * The Copilot may only CREATE drafts. A draft does nothing until a coordinator
 * (or admin) approves it here; only then is the `onApproved` dispatcher called,
 * which Member 2 wires to outreach/notifications. Safety rules are re-checked
 * at approval time because a request can change after the draft was written.
 */
import { canStartDonorOutreach, type BloodComponent, type BloodGroup, type UserRole } from "@raktdoot/shared";
import type { CopilotDataSource } from "./data-source.ts";

export const DRAFT_KINDS = ["DONOR_OUTREACH", "DONATION_CAMPAIGN"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DRAFT_STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/** Only these roles may approve sending messages (docs/USER_ROLES.md). */
export const APPROVER_ROLES = ["COORDINATOR", "ADMIN"] as const satisfies readonly UserRole[];

export interface CopilotDraft {
  id: string;
  kind: DraftKind;
  status: DraftStatus;
  /** Set for DONOR_OUTREACH (verified request only). */
  requestId: string | null;
  /** Set for DONATION_CAMPAIGN (area-level, opted-in eligible donors only). */
  district: string | null;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  /** Proposed audience description, e.g. "wave 1: top 5 ranked donors". */
  audience: string;
  /** Message text from reviewed templates (templates.ts); coordinator may edit before approval. */
  message: string;
  /** Why the Copilot proposed this (shown to the coordinator). */
  rationale: string;
  createdAt: string;
  decidedAt: string | null;
  decidedByRole: UserRole | null;
  decisionNote: string | null;
}

export type NewDraft = Pick<
  CopilotDraft,
  "kind" | "requestId" | "district" | "bloodGroup" | "component" | "audience" | "message" | "rationale"
>;

export type DecisionResult = { ok: true; draft: CopilotDraft } | { ok: false; reason: string };

export interface ApprovalStoreOptions {
  data: CopilotDataSource;
  /** Called once per approved draft. Member 2: send via outreach waves / notifications. */
  onApproved?: (draft: CopilotDraft) => Promise<void> | void;
  now?: () => Date;
  newId?: () => string;
}

export function isApproverRole(role: UserRole): boolean {
  return (APPROVER_ROLES as readonly UserRole[]).includes(role);
}


/**
 * In-memory store for the demo. Member 2 can replace the Map with a Prisma table
 * keeping the same rules.
 */
export class ApprovalStore {
  private readonly drafts = new Map<string, CopilotDraft>();
  private readonly data: CopilotDataSource;
  private readonly onApproved?: ApprovalStoreOptions["onApproved"];
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(options: ApprovalStoreOptions) {
    this.data = options.data;
    this.onApproved = options.onApproved;
    this.now = options.now ?? (() => new Date());
    let counter = 0;
    this.newId = options.newId ?? (() => `DRAFT-${Date.now().toString(36)}-${(++counter).toString(36)}`);
  }

  /** Creates a PENDING_APPROVAL draft. Never sends anything. */
  async createDraft(input: NewDraft): Promise<DecisionResult> {
    const problem = await this.safetyProblem(input);
    if (problem) return { ok: false, reason: problem };
    const draft: CopilotDraft = {
      ...input,
      id: this.newId(),
      status: "PENDING_APPROVAL",
      createdAt: this.now().toISOString(),
      decidedAt: null,
      decidedByRole: null,
      decisionNote: null,
    };
    this.drafts.set(draft.id, draft);
    return { ok: true, draft: { ...draft } };
  }

  get(id: string): CopilotDraft | null {
    const draft = this.drafts.get(id);
    return draft ? { ...draft } : null;
  }

  list(status?: DraftStatus): CopilotDraft[] {
    return [...this.drafts.values()].filter((d) => !status || d.status === status).map((d) => ({ ...d }));
  }

  /** Coordinator edits the text before approving. Only pending drafts can change. */
  editMessage(id: string, message: string, actorRole: UserRole): DecisionResult {
    const draft = this.drafts.get(id);
    if (!draft) return { ok: false, reason: "Draft not found" };
    if (!isApproverRole(actorRole)) return { ok: false, reason: "Only coordinators can edit drafts" };
    if (draft.status !== "PENDING_APPROVAL") return { ok: false, reason: `Draft is already ${draft.status}` };
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 1000) return { ok: false, reason: "Message must be 1-1000 characters" };
    draft.message = trimmed;
    return { ok: true, draft: { ...draft } };
  }

  async approve(id: string, actorRole: UserRole, note?: string): Promise<DecisionResult> {
    const draft = this.drafts.get(id);
    if (!draft) return { ok: false, reason: "Draft not found" };
    if (!isApproverRole(actorRole)) return { ok: false, reason: "Only coordinators can approve sending messages" };
    if (draft.status !== "PENDING_APPROVAL") return { ok: false, reason: `Draft is already ${draft.status}` };
    const problem = await this.safetyProblem(draft); // re-check: the request may have changed
    if (problem) return { ok: false, reason: problem };

    this.decide(draft, "APPROVED", actorRole, note);
    await this.onApproved?.({ ...draft });
    return { ok: true, draft: { ...draft } };
  }

  reject(id: string, actorRole: UserRole, note?: string): DecisionResult {
    const draft = this.drafts.get(id);
    if (!draft) return { ok: false, reason: "Draft not found" };
    if (!isApproverRole(actorRole)) return { ok: false, reason: "Only coordinators can reject drafts" };
    if (draft.status !== "PENDING_APPROVAL") return { ok: false, reason: `Draft is already ${draft.status}` };
    this.decide(draft, "REJECTED", actorRole, note);
    return { ok: true, draft: { ...draft } };
  }

  private decide(draft: CopilotDraft, status: DraftStatus, role: UserRole, note?: string): void {
    draft.status = status;
    draft.decidedAt = this.now().toISOString();
    draft.decidedByRole = role;
    draft.decisionNote = note?.trim() || null;
  }

  private async safetyProblem(input: NewDraft): Promise<string | null> {
    if (input.component === "UNKNOWN") return "Component is unknown; confirm it with the requester first";
    if (input.kind === "DONOR_OUTREACH") {
      if (!input.requestId) return "Donor outreach needs a request ID";
      const request = await this.data.getRequest(input.requestId);
      if (!request) return `Request ${input.requestId} not found`;
      if (request.status === "CLOSED") return `Request ${input.requestId} is closed`;
      if (!canStartDonorOutreach(request.verification)) {
        return `Request ${input.requestId} is ${request.verification}; private donors are contacted only for verified requests`;
      }
    } else if (!input.district) {
      return "A donation campaign needs a district";
    }
    return null;
  }
}
