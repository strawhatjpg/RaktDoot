/**
 * RaktDoot coins (revised rewards policy, docs/REWARDS_POLICY.md).
 * Guardrails encoded here so every surface (app, bot, worker) uses the same rules:
 *  - Donors earn only for a donation CONFIRMED BY A BLOOD CENTRE, never for tapping Accept.
 *  - Referrers earn when the person they referred registers as a donor, and a bonus
 *    when that person's first donation is confirmed. Bare app installs earn nothing.
 *  - Coins are non-transferable, have no cash value, and never affect access to blood.
 */
export const REWARD_COINS = {
  DONATION_CONFIRMED: 100,
  REFERRAL_DONOR_REGISTERED: 25,
  REFERRAL_FIRST_DONATION: 50,
} as const;

/** A referral can only be attached to an account created within this window. */
export const REFERRAL_ATTACH_WINDOW_HOURS = 24;
/** Referral rewards per referrer per rolling 30 days (anti-farming). */
export const MAX_REFERRAL_REWARDS_PER_30_DAYS = 10;

/** No 0/O/1/I/L to avoid misreading codes shared verbally. */
export const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_LENGTH = 8;

export function isValidReferralCode(value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`).test(value);
}

/** `randomIndex(n)` must return a uniform integer in [0, n). Server passes crypto.randomInt. */
export function generateReferralCode(randomIndex: (n: number) => number): string {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) code += REFERRAL_CODE_ALPHABET[randomIndex(REFERRAL_CODE_ALPHABET.length)];
  return code;
}

/** Sponsor coupon codes: 4-40 chars, letters, digits and dashes. */
export function isValidCouponCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{4,40}$/.test(value);
}