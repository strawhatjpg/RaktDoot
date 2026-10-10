import { WHOLE_BLOOD_INTERVAL_DAYS, type DonorSex } from "./constants.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Earliest date a donor MAY be eligible again for whole blood.
 * Provisional: used for reminders and filtering only, never as a medical decision.
 */
export function provisionalNextEligibleDate(lastDonation: Date, sex: DonorSex): Date {
  if (Number.isNaN(lastDonation.getTime())) {
    throw new RangeError("lastDonation must be a valid date");
  }
  return new Date(lastDonation.getTime() + WHOLE_BLOOD_INTERVAL_DAYS[sex] * DAY_MS);
}

/** True when the donor has no recorded donation or the minimum interval has passed. */
export function isPastDonationInterval(
  lastDonation: Date | null,
  sex: DonorSex,
  now: Date = new Date(),
): boolean {
  if (lastDonation === null) return true;
  return now.getTime() >= provisionalNextEligibleDate(lastDonation, sex).getTime();
}

/** Whole days remaining until the provisional eligibility date (0 if already past). */
export function daysUntilEligible(lastDonation: Date | null, sex: DonorSex, now: Date = new Date()): number {
  if (lastDonation === null) return 0;
  const remainingMs = provisionalNextEligibleDate(lastDonation, sex).getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / DAY_MS);
}