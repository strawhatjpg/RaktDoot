/**
 * Explainable donor matching (docs/PIPELINES.md § B). Pure functions: the server
 * loads data, these decide. Hard filters first, then a bounded, explained score.
 */
import { WHOLE_BLOOD_INTERVAL_DAYS, type BloodComponent, type BloodGroup, type DonorSex } from "./constants.ts";
import { effectiveAvailability } from "./donor.ts";
import { haversineKm, type Coordinates } from "./geo.ts";
import type { Availability } from "./constants.ts";

const DAY_MS = 86_400_000;

/** Locations older than this are too stale to route a donor on. */
export const MATCH_LOCATION_MAX_AGE_DAYS = 90;
/** Donors alerted within this window count toward "recent alert load". */
export const ALERT_LOAD_WINDOW_DAYS = 14;

/**
 * Planned weights from PIPELINES.md were availability 0.35, distance 0.30, ETA 0.15,
 * alert load 0.20. ETA is only known after a donor accepts, so its weight is moved
 * to distance (which is the best pre-acceptance proxy for arrival time).
 */
export const MATCH_WEIGHTS = { availabilityFreshness: 0.35, distance: 0.45, alertLoad: 0.2 } as const;

export type ExclusionReason =
  | "BLOOD_GROUP_MISMATCH" | "NO_ALERT_CONSENT" | "NOT_AVAILABLE" | "NO_LOCATION" | "LOCATION_STALE"
  | "OUT_OF_RADIUS" | "RECENT_DONATION" | "ALREADY_COMMITTED" | "ALREADY_INVITED" | "IS_REQUESTER";

export interface DonorCandidateInput {
  donorId: string;
  displayName: string;
  bloodGroup: BloodGroup;
  sex: DonorSex;
  availability: Availability;
  unavailableUntil: Date | null;
  availabilityUpdatedAt: Date;
  travelRadiusKm: number;
  lastDonationAt: Date | null;
  location: (Coordinates & { updatedAt: Date }) | null;
  hasAlertConsent: boolean;
  /** Committed (accepted/arrived) to another open request. */
  committedElsewhere: boolean;
  alreadyInvited: boolean;
  isRequester: boolean;
  alertsLast14Days: number;
}

export interface MatchTarget {
  bloodGroup: BloodGroup;
  component: BloodComponent;
  hospital: Coordinates;
  /** Wave-level cap; a donor's own radius still applies. */
  maxRadiusKm: number;
}

export type MatchDecision =
  | { eligible: true; donorId: string; displayName: string; distanceKm: number; score: number; reasons: string[] }
  | { eligible: false; donorId: string; reason: ExclusionReason };

/**
 * Exact-group matching only. The platform never suggests clinical substitutions
 * (e.g. O- for A+): compatibility decisions belong to the blood centre.
 */
export function evaluateDonor(d: DonorCandidateInput, target: MatchTarget, now: Date = new Date()): MatchDecision {
  const no = (reason: ExclusionReason): MatchDecision => ({ eligible: false, donorId: d.donorId, reason });
  if (d.isRequester) return no("IS_REQUESTER");
  if (d.bloodGroup !== target.bloodGroup) return no("BLOOD_GROUP_MISMATCH");
  if (!d.hasAlertConsent) return no("NO_ALERT_CONSENT");
  if (effectiveAvailability(d.availability, d.unavailableUntil, now) !== "AVAILABLE") return no("NOT_AVAILABLE");
  if (d.alreadyInvited) return no("ALREADY_INVITED");
  if (d.committedElsewhere) return no("ALREADY_COMMITTED");
  if (!d.location) return no("NO_LOCATION");
  if (now.getTime() - d.location.updatedAt.getTime() > MATCH_LOCATION_MAX_AGE_DAYS * DAY_MS) return no("LOCATION_STALE");
  const distanceKm = haversineKm(d.location, target.hospital);
  if (distanceKm > Math.min(d.travelRadiusKm, target.maxRadiusKm)) return no("OUT_OF_RADIUS");
  if (d.lastDonationAt && now.getTime() - d.lastDonationAt.getTime() < WHOLE_BLOOD_INTERVAL_DAYS[d.sex] * DAY_MS) {
    return no("RECENT_DONATION");
  }

  const ageDays = Math.max(0, (now.getTime() - d.availabilityUpdatedAt.getTime()) / DAY_MS);
  const freshness = Math.max(0, 1 - ageDays / 30);
  const proximity = Math.max(0, 1 - distanceKm / Math.max(1, target.maxRadiusKm));
  const load = Math.max(0, 1 - d.alertsLast14Days / 5);
  const score = MATCH_WEIGHTS.availabilityFreshness * freshness + MATCH_WEIGHTS.distance * proximity + MATCH_WEIGHTS.alertLoad * load;
  const reasons = [
    `${distanceKm.toFixed(1)} km straight-line from the hospital`,
    ageDays < 1 ? "availability confirmed today" : `availability confirmed ${Math.round(ageDays)} day(s) ago`,
    d.alertsLast14Days === 0 ? "no alerts in the last 14 days" : `${d.alertsLast14Days} alert(s) in the last 14 days`,
  ];
  return { eligible: true, donorId: d.donorId, displayName: d.displayName, distanceKm: Math.round(distanceKm * 10) / 10, score: Math.round(score * 1000) / 1000, reasons };
}

/** Eligible donors ranked best first (ties: nearer, then id for determinism). */
export function rankDonors(donors: readonly DonorCandidateInput[], target: MatchTarget, now: Date = new Date()) {
  const decisions = donors.map((d) => evaluateDonor(d, target, now));
  const eligible = decisions
    .filter((d): d is Extract<MatchDecision, { eligible: true }> => d.eligible)
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.donorId.localeCompare(b.donorId));
  const excluded: Partial<Record<ExclusionReason, number>> = {};
  for (const d of decisions) if (!d.eligible) excluded[d.reason] = (excluded[d.reason] ?? 0) + 1;
  return { eligible, excluded };
}

/** Wave plan: wave 1 = 5 donors within 10 km, wave 2 = 10 within 25 km, wave 3 = 15 within 50 km. */
export const WAVE_PLAN = [
  { waveNumber: 1, size: 5, radiusKm: 10, windowMinutes: 20 },
  { waveNumber: 2, size: 10, radiusKm: 25, windowMinutes: 30 },
  { waveNumber: 3, size: 15, radiusKm: 50, windowMinutes: 45 },
] as const;

export function wavePlan(waveNumber: number) {
  return WAVE_PLAN.find((w) => w.waveNumber === waveNumber) ?? null;
}