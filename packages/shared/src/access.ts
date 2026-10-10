import type { UserRole } from "./constants.ts";

/** This context must come from a server-validated session, never the HTTP body. */
export interface ActorContext {
  userId: string;
  role: UserRole;
  verified: boolean;
  hospitalId: string | null;
  district: string | null;
}

export function canAccessHospitalCases(actor: ActorContext, hospitalId: string, district: string): boolean {
  if (!actor.verified) return false;
  if (actor.role === "ADMIN") return true;
  if (actor.role === "HOSPITAL_STAFF") return actor.hospitalId === hospitalId;
  if (actor.role === "COORDINATOR") return actor.district !== null && actor.district === district;
  // Centre staff get access only through future explicit case assignments, not globally.
  return false;
}

export function canReadBloodRequest(actor: ActorContext, request: { requesterId: string; hospitalId: string; district: string }): boolean {
  return request.requesterId === actor.userId || canAccessHospitalCases(actor, request.hospitalId, request.district);
}