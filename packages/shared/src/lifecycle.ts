import {
  VERIFIER_ROLES,
  type FinalOutcome,
  type RequestStatus,
  type UserRole,
  type VerificationStatus,
} from "./constants.ts";

/** Allowed stage transitions. Any non-closed stage may additionally move to CLOSED. */
const TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  DRAFT: ["AWAITING_CONFIRMATION"],
  AWAITING_CONFIRMATION: ["OPEN", "DRAFT"],
  OPEN: ["CENTRES_LISTED"],
  CENTRES_LISTED: ["STOCK_CONFIRMED", "OUTREACH_ACTIVE"],
  STOCK_CONFIRMED: ["OUTREACH_ACTIVE"], // reported stock fell through
  OUTREACH_ACTIVE: ["DONOR_ACCEPTED"],
  DONOR_ACCEPTED: ["DONOR_ARRIVED", "OUTREACH_ACTIVE"], // donor dropped out
  DONOR_ARRIVED: ["DONATION_CONFIRMED", "OUTREACH_ACTIVE"], // deferred at screening
  DONATION_CONFIRMED: ["OUTREACH_ACTIVE"], // more units still needed
  CLOSED: ["OPEN"], // reopen
};

/** Roles allowed to close a request with any outcome. Requesters may only cancel their own. */
const CLOSER_ROLES: readonly UserRole[] = ["HOSPITAL_STAFF", "BLOOD_CENTRE_STAFF", "COORDINATOR", "ADMIN"];

export interface TransitionContext {
  actorRole: UserRole;
  verification: VerificationStatus;
  outcome?: FinalOutcome;
  /** True when the actor is the requester who created this request. */
  actorIsOwner?: boolean;
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export function allowedNextStatuses(current: RequestStatus): RequestStatus[] {
  const next = [...TRANSITIONS[current]];
  if (current !== "CLOSED") next.push("CLOSED");
  return next;
}

/** Contacting private donors requires a verified request; listing public blood centres does not. */
export function canStartDonorOutreach(verification: VerificationStatus): boolean {
  return verification === "VERIFIED";
}

export function canVerifyRequests(role: UserRole): boolean {
  return VERIFIER_ROLES.includes(role);
}

export function checkTransition(current: RequestStatus, next: RequestStatus, ctx: TransitionContext): TransitionResult {
  if (!allowedNextStatuses(current).includes(next)) {
    return { ok: false, reason: `Cannot move from ${current} to ${next}` };
  }

  if (next === "OUTREACH_ACTIVE" && !canStartDonorOutreach(ctx.verification)) {
    return { ok: false, reason: "Request must be verified before donors are contacted" };
  }

  if (next === "STOCK_CONFIRMED" || next === "DONATION_CONFIRMED") {
    if (ctx.actorRole !== "BLOOD_CENTRE_STAFF" && ctx.actorRole !== "COORDINATOR" && ctx.actorRole !== "ADMIN") {
      return { ok: false, reason: `${next} must be recorded by blood centre staff or a coordinator` };
    }
  }

  if (next === "CLOSED") {
    if (ctx.outcome === undefined) return { ok: false, reason: "Closing requires a final outcome" };
    const isStaff = CLOSER_ROLES.includes(ctx.actorRole);
    const isOwnerCancelling = ctx.actorRole === "REQUESTER" && ctx.actorIsOwner === true && ctx.outcome === "CANCELLED";
    if (!isStaff && !isOwnerCancelling) {
      return { ok: false, reason: "Only staff can close with this outcome; requesters may cancel their own request" };
    }
  }

  if (current === "CLOSED" && next === "OPEN" && !CLOSER_ROLES.includes(ctx.actorRole)) {
    return { ok: false, reason: "Only staff can reopen a request" };
  }

  return { ok: true };
}