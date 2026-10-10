import { test } from "node:test";
import assert from "node:assert/strict";
import { generateReferralCode, isValidCouponCode, isValidReferralCode, REFERRAL_CODE_ALPHABET, REWARD_COINS } from "../src/rewards.ts";

test("referral codes are 8 unambiguous characters and validate", () => {
  let i = 0;
  const code = generateReferralCode((n) => (i++ * 7) % n);
  assert.equal(code.length, 8);
  assert.ok([...code].every((c) => REFERRAL_CODE_ALPHABET.includes(c)));
  assert.equal(isValidReferralCode(code), true);
  for (const bad of ["", "ABCDEFG", "ABCDEFGHJ", "abcdefgh", "ABCDEFG0", "ABCDEFGI", 12345678, null]) assert.equal(isValidReferralCode(bad), false);
});

test("coupon codes are bounded and printable", () => {
  assert.equal(isValidCouponCode("CAFE-2026-0001"), true);
  for (const bad of ["abc", "x".repeat(41), "has space", "semi;colon", 5]) assert.equal(isValidCouponCode(bad), false);
});

test("donation is worth more than a referral; referrals never pay for installs alone", () => {
  assert.ok(REWARD_COINS.DONATION_CONFIRMED > REWARD_COINS.REFERRAL_FIRST_DONATION);
  assert.ok(REWARD_COINS.REFERRAL_FIRST_DONATION > REWARD_COINS.REFERRAL_DONOR_REGISTERED);
  assert.deepEqual(Object.keys(REWARD_COINS).sort(), ["DONATION_CONFIRMED", "REFERRAL_DONOR_REGISTERED", "REFERRAL_FIRST_DONATION"]);
});