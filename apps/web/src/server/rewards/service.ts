/**
 * Coins, referrals and the sponsor coupon store (docs/REWARDS_POLICY.md, revised).
 *
 * Ledger rules: every change is a CoinEntry with a unique refKey (idempotent), and the
 * Wallet balance changes in the same transaction. Debits use a conditional update
 * (balance >= cost) so two simultaneous redemptions can never overspend.
 * The whole feature is gated by FEATURE_TOKEN_REWARDS=true.
 */
import { randomInt } from "node:crypto";
import {
  generateReferralCode, isValidCouponCode, isValidIdempotencyKey, isValidReferralCode,
  MAX_REFERRAL_REWARDS_PER_30_DAYS, REFERRAL_ATTACH_WINDOW_HOURS, REWARD_COINS, type ActorContext,
} from "@raktdoot/shared";
import type { Prisma } from "@prisma/client";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";

type Tx = Prisma.TransactionClient;
export type CoinReason = keyof typeof REWARD_COINS | "REDEMPTION" | "ADJUSTMENT";

export function rewardsEnabled(): boolean {
  return process.env.FEATURE_TOKEN_REWARDS === "true";
}

function requireEnabled(): void {
  if (!rewardsEnabled()) throw new ApiError(404, "REWARDS_DISABLED", "Rewards are not enabled on this server");
}

/** Idempotent credit. Returns false if this refKey was already awarded. */
export async function credit(tx: Tx, userId: string, amount: number, reason: CoinReason, refKey: string, note?: string): Promise<boolean> {
  if (!rewardsEnabled() || amount <= 0) return false;
  const exists = await tx.coinEntry.findUnique({ where: { refKey }, select: { id: true } });
  if (exists) return false;
  await tx.coinEntry.create({ data: { userId, amount, reason, refKey, note: note?.slice(0, 200) ?? null } });
  await tx.wallet.upsert({ where: { userId }, create: { userId, balance: amount }, update: { balance: { increment: amount } } });
  return true;
}

/** Awards for a centre-confirmed donation: the donor, plus the referrer's first-donation bonus. */
export async function rewardConfirmedDonation(tx: Tx, donorId: string, inviteId: string): Promise<number> {
  if (!rewardsEnabled()) return 0;
  const coins = (await credit(tx, donorId, REWARD_COINS.DONATION_CONFIRMED, "DONATION_CONFIRMED", `donation:${inviteId}`, "Donation confirmed by blood centre")) ? REWARD_COINS.DONATION_CONFIRMED : 0;
  const referral = await tx.referral.findUnique({ where: { referredUserId: donorId } });
  if (referral && !referral.donationRewardedAt && await underReferralCap(tx, referral.referrerId)) {
    await credit(tx, referral.referrerId, REWARD_COINS.REFERRAL_FIRST_DONATION, "REFERRAL_FIRST_DONATION", `referral-donation:${referral.id}`, "Someone you referred donated");
    await tx.referral.update({ where: { id: referral.id }, data: { donationRewardedAt: new Date() } });
  }
  return coins;
}

/** Called when a referred user becomes a donor (app or WhatsApp). */
export async function rewardReferredDonorRegistered(tx: Tx, userId: string): Promise<void> {
  if (!rewardsEnabled()) return;
  const referral = await tx.referral.findUnique({ where: { referredUserId: userId } });
  if (!referral || referral.donorRewardedAt || !(await underReferralCap(tx, referral.referrerId))) return;
  await credit(tx, referral.referrerId, REWARD_COINS.REFERRAL_DONOR_REGISTERED, "REFERRAL_DONOR_REGISTERED", `referral-donor:${referral.id}`, "Someone you referred registered as a donor");
  await tx.referral.update({ where: { id: referral.id }, data: { donorRewardedAt: new Date() } });
}

async function underReferralCap(tx: Tx, referrerId: string): Promise<boolean> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const n = await tx.coinEntry.count({ where: { userId: referrerId, reason: { in: ["REFERRAL_DONOR_REGISTERED", "REFERRAL_FIRST_DONATION"] }, createdAt: { gte: since } } });
  return n < MAX_REFERRAL_REWARDS_PER_30_DAYS;
}

// ---------------------------------------------------------------- referrals

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const db = getDb();
  const existing = await db.referralCode.findUnique({ where: { userId } });
  if (existing) return existing.code;
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode((n) => randomInt(0, n));
    try { return (await db.referralCode.create({ data: { code, userId } })).code; }
    catch { /* code collision or concurrent create; retry / re-read */ }
    const raced = await db.referralCode.findUnique({ where: { userId } });
    if (raced) return raced.code;
  }
  throw new ApiError(503, "TRY_AGAIN", "Could not create a referral code, please retry");
}

/**
 * Links a new account to its referrer. Rules: valid code, not yourself, only once,
 * and only for accounts created within the attach window (new users, not existing ones).
 * Never throws for the bot path; returns whether a link was made.
 */
export async function attachReferral(userId: string, code: unknown): Promise<{ attached: boolean; reason?: string }> {
  if (!rewardsEnabled()) return { attached: false, reason: "disabled" };
  if (!isValidReferralCode(code)) return { attached: false, reason: "invalid_code" };
  const db = getDb();
  return db.$transaction(async (tx) => {
    const owner = await tx.referralCode.findUnique({ where: { code } });
    if (!owner) return { attached: false, reason: "unknown_code" };
    if (owner.userId === userId) return { attached: false, reason: "self" };
    const user = await tx.user.findUnique({ where: { id: userId }, include: { referredBy: true } });
    if (!user) return { attached: false, reason: "unknown_user" };
    if (user.referredBy) return { attached: false, reason: "already_referred" };
    if (Date.now() - user.createdAt.getTime() > REFERRAL_ATTACH_WINDOW_HOURS * 3_600_000) return { attached: false, reason: "account_too_old" };
    await tx.referral.create({ data: { referrerId: owner.userId, referredUserId: userId } });
    await tx.auditLog.create({ data: { actorId: userId, action: "REFERRAL_ATTACHED", entity: "User", entityId: userId } });
    // Already a donor (e.g. signed up on WhatsApp before opening the link): reward now.
    if (await tx.donorProfile.findUnique({ where: { userId } })) await rewardReferredDonorRegistered(tx, userId);
    return { attached: true };
  });
}

// ---------------------------------------------------------------- wallet + store

export async function getWallet(actor: ActorContext) {
  requireEnabled();
  const db = getDb();
  const [wallet, entries, code, referrals, redemptions] = await Promise.all([
    db.wallet.findUnique({ where: { userId: actor.userId } }),
    db.coinEntry.findMany({ where: { userId: actor.userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    getOrCreateReferralCode(actor.userId),
    db.referral.findMany({ where: { referrerId: actor.userId }, select: { donorRewardedAt: true, donationRewardedAt: true } }),
    db.redemption.findMany({ where: { userId: actor.userId }, include: { item: { include: { sponsor: true } }, coupon: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const base = process.env.APP_BASE_URL ?? "";
  return {
    balance: wallet?.balance ?? 0,
    entries: entries.map((e) => ({ amount: e.amount, reason: e.reason, note: e.note, createdAt: e.createdAt.toISOString() })),
    referral: {
      code, link: `${base}/r/${code}`,
      whatsappText: `Join me on RaktDoot to help patients who need blood nearby. Sign up: ${base}/r/${code}`,
      joined: referrals.length, becameDonors: referrals.filter((r) => r.donorRewardedAt).length, donated: referrals.filter((r) => r.donationRewardedAt).length,
    },
    coupons: redemptions.map((r) => ({ redemptionId: r.id, title: r.item.title, sponsor: r.item.sponsor.name, code: r.coupon.code, coins: r.coins, redeemedAt: r.createdAt.toISOString() })),
  };
}

export async function listStore(actor: ActorContext | null) {
  requireEnabled();
  const db = getDb();
  const items = await db.storeItem.findMany({ where: { active: true }, include: { sponsor: true }, orderBy: [{ costCoins: "asc" }, { id: "asc" }] });
  const stock = await db.couponCode.groupBy({ by: ["itemId"], where: { redeemedById: null, itemId: { in: items.map((i) => i.id) } }, _count: { _all: true } });
  const left = new Map(stock.map((s) => [s.itemId, s._count._all]));
  const mine = actor ? await db.redemption.groupBy({ by: ["itemId"], where: { userId: actor.userId }, _count: { _all: true } }) : [];
  const used = new Map(mine.map((m) => [m.itemId, m._count._all]));
  return items.map((i) => ({
    id: i.id, title: i.title, description: i.description, costCoins: i.costCoins, sponsor: i.sponsor.name, isSimulated: i.isSimulated || i.sponsor.isSimulated,
    remaining: left.get(i.id) ?? 0, perUserLimit: i.perUserLimit, redeemedByYou: used.get(i.id) ?? 0,
  }));
}

/**
 * Redeem coins for one sponsor coupon. Atomic: debit (balance >= cost) and claim an
 * unused code in one transaction; idempotent per user + Idempotency-Key.
 */
export async function redeem(actor: ActorContext, itemId: unknown, key: unknown) {
  requireEnabled();
  if (typeof itemId !== "string" || !/^[\w-]{1,100}$/.test(itemId)) throw new ApiError(400, "VALIDATION_ERROR", "Choose a store item", { itemId: "invalid" });
  if (!isValidIdempotencyKey(key)) throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "Provide an Idempotency-Key of 8–128 safe characters");
  const db = getDb();
  const prior = await db.redemption.findUnique({ where: { userId_idempotencyKey: { userId: actor.userId, idempotencyKey: key } }, include: { coupon: true, item: { include: { sponsor: true } } } });
  if (prior) {
    if (prior.itemId !== itemId) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This key was already used for a different item");
    return { replayed: true, code: prior.coupon.code, title: prior.item.title, sponsor: prior.item.sponsor.name, balance: (await db.wallet.findUnique({ where: { userId: actor.userId } }))?.balance ?? 0 };
  }
  return db.$transaction(async (tx) => {
    const item = await tx.storeItem.findUnique({ where: { id: itemId }, include: { sponsor: true } });
    if (!item || !item.active) throw new ApiError(404, "NOT_FOUND", "This reward is not available");
    const already = await tx.redemption.count({ where: { userId: actor.userId, itemId } });
    if (already >= item.perUserLimit) throw new ApiError(409, "LIMIT_REACHED", "You have already redeemed this reward");
    const debit = await tx.wallet.updateMany({ where: { userId: actor.userId, balance: { gte: item.costCoins } }, data: { balance: { decrement: item.costCoins } } });
    if (debit.count === 0) throw new ApiError(409, "INSUFFICIENT_COINS", `You need ${item.costCoins} coins for this reward`);
    const coupon = await tx.couponCode.findFirst({ where: { itemId, redeemedById: null }, orderBy: { id: "asc" } });
    if (!coupon) throw new ApiError(409, "OUT_OF_STOCK", "This reward is out of stock");
    // Conditional claim: if another redeemer took this code first, fail and roll back.
    const claim = await tx.couponCode.updateMany({ where: { id: coupon.id, redeemedById: null }, data: { redeemedById: actor.userId, redeemedAt: new Date() } });
    if (claim.count === 0) throw new ApiError(409, "TRY_AGAIN", "That coupon was just taken, please retry");
    const redemption = await tx.redemption.create({ data: { userId: actor.userId, itemId, couponId: coupon.id, coins: item.costCoins, idempotencyKey: key } });
    await tx.coinEntry.create({ data: { userId: actor.userId, amount: -item.costCoins, reason: "REDEMPTION", refKey: `redemption:${redemption.id}`, note: `${item.sponsor.name}: ${item.title}`.slice(0, 200) } });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "COUPON_REDEEMED", entity: "StoreItem", entityId: itemId } });
    const balance = (await tx.wallet.findUniqueOrThrow({ where: { userId: actor.userId } })).balance;
    return { replayed: false, code: coupon.code, title: item.title, sponsor: item.sponsor.name, balance };
  });
}

// ---------------------------------------------------------------- sponsor admin

const isAdmin = (a: ActorContext) => a.verified && a.role === "ADMIN";

/** Admin adds a sponsor reward with its coupon codes (the sponsor supplies the codes). */
export async function createStoreItem(actor: ActorContext, body: unknown) {
  requireEnabled();
  if (!isAdmin(actor)) throw new ApiError(403, "FORBIDDEN", "Only admins manage the store");
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const sponsorName = typeof b.sponsorName === "string" ? b.sponsorName.trim() : "";
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const cost = b.costCoins;
  const codes = Array.isArray(b.couponCodes) ? b.couponCodes : [];
  if (sponsorName.length < 2 || sponsorName.length > 80) fields.sponsorName = "2-80 characters";
  if (title.length < 3 || title.length > 80) fields.title = "3-80 characters";
  if (description.length < 3 || description.length > 300) fields.description = "3-300 characters";
  if (typeof cost !== "number" || !Number.isSafeInteger(cost) || cost < 10 || cost > 100_000) fields.costCoins = "10-100000";
  if (codes.length < 1 || codes.length > 1000 || !codes.every(isValidCouponCode) || new Set(codes).size !== codes.length) fields.couponCodes = "1-1000 unique codes, 4-40 letters/digits/dashes";
  if (Object.keys(fields).length) throw new ApiError(400, "VALIDATION_ERROR", "Check the store item fields", fields);
  return getDb().$transaction(async (tx) => {
    const sponsor = (await tx.sponsor.findFirst({ where: { name: sponsorName } })) ?? (await tx.sponsor.create({ data: { name: sponsorName } }));
    const item = await tx.storeItem.create({ data: { sponsorId: sponsor.id, title, description, costCoins: cost as number } });
    await tx.couponCode.createMany({ data: (codes as string[]).map((code) => ({ itemId: item.id, code })) });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "STORE_ITEM_CREATED", entity: "StoreItem", entityId: item.id } });
    return { id: item.id, coupons: codes.length };
  });
}