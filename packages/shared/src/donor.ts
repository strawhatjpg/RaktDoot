import type { Availability } from "./constants.ts";

/**
 * Availability that matching should use. An expired or open-ended UNAVAILABLE
 * becomes PAUSED: the donor must reconfirm before receiving urgent alerts.
 */
export function effectiveAvailability(state: Availability, unavailableUntil: Date | null, now: Date = new Date()): Availability {
  if (state === "UNAVAILABLE" && (unavailableUntil === null || unavailableUntil.getTime() <= now.getTime())) return "PAUSED";
  return state;
}