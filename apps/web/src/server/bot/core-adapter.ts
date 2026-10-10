/**
 * M2's real implementation of M1's CoreApi (packages/bot/src/core-api.ts).
 * Every call is keyed by a WhatsApp-verified phone number (the webhook signature or
 * the simulator), never by anything the user typed.
 */
import { createHash } from "node:crypto";
import type { CoreApi, CreateRequestInput, ConversationState } from "@raktdoot/bot";
import {
  CURRENT_TERMS_VERSION, coarsenCoordinates, type ActorContext, type BloodGroup, type ConsentType, type LanguageCode,
  type LocationUpdateDTO, type NotificationChannel,
} from "@raktdoot/shared";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";
import { updateConsents } from "../consent/service.ts";
import { createBloodRequest } from "../requests/service.ts";
import { respondToInvite as respond } from "../outreach/service.ts";
import { flushOutbox } from "../notifications/sender.ts";
import { attachReferral, rewardReferredDonorRegistered } from "../rewards/service.ts";

/** "JOIN ABCD2345" (prefilled by a referral link) attaches the referral before onboarding. */
const JOIN_RE = /^\s*join\s+([A-Za-z0-9]{8})\s*$/i;
export async function handleReferralMessage(phone: string, text: string | undefined): Promise<boolean> {
  const m = text ? JOIN_RE.exec(text) : null;
  if (!m) return false;
  const actor = await actorFor(phone);
  await attachReferral(actor.userId, m[1]!.toUpperCase());
  return true;
}

async function actorFor(phone: string): Promise<ActorContext> {
  if (!/^\+\d{8,15}$/.test(phone)) throw new Error("phone must be E.164");
  const user = await getDb().user.upsert({ where: { phone }, update: {}, create: { phone, name: "WhatsApp user", role: "REQUESTER" } });
  return { userId: user.id, role: user.role, verified: user.verifiedAt !== null, hospitalId: user.hospitalId, district: user.district };
}

/** Fuzzy hospital match on the seeded directory: exact, then contains, then token overlap. */
export async function resolveHospital(name: string): Promise<{ id: string; name: string } | null> {
  const hospitals = await getDb().hospital.findMany({ select: { id: true, name: true }, take: 500 });
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]/g, " ").replace(/\b(hospital|hosp|the|fictional|demo)\b/g, " ").replace(/\s+/g, " ").trim();
  const q = norm(name);
  if (!q) return null;
  const exact = hospitals.find((h) => norm(h.name) === q);
  if (exact) return exact;
  const contains = hospitals.filter((h) => norm(h.name).includes(q) || q.includes(norm(h.name)));
  if (contains.length === 1) return contains[0]!;
  const qt = new Set(q.split(" "));
  const scored = hospitals.map((h) => ({ h, n: norm(h.name).split(" ").filter((t) => qt.has(t)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  if (scored.length === 0 || (scored.length > 1 && scored[0]!.n === scored[1]!.n)) return null;
  return scored[0]!.h;
}

export function createPrismaCoreApi(appBaseUrl: string): CoreApi {
  const db = getDb();
  return {
    async getState(phone) {
      const row = await db.botConversation.findUnique({ where: { phone } });
      return row ? (JSON.parse(row.state) as ConversationState) : null;
    },
    async saveState(phone, state) {
      // After DELETE MY DATA the bot still saves state once; keep nothing for erased numbers.
      if (erased.has(phone)) { erased.delete(phone); return; }
      const json = JSON.stringify(state);
      await db.botConversation.upsert({ where: { phone }, update: { state: json }, create: { phone, state: json } });
    },
    async upsertUser(phone, data) {
      await actorFor(phone);
      // Role changes from the bot are ignored: staff roles are admin-assigned only.
      if (data.language) await db.user.update({ where: { phone }, data: { preferredLanguage: data.language } });
    },
    async recordConsent(phone, type: ConsentType, channel: NotificationChannel | null, granted) {
      if (type === "CONTACT_SHARING") return; // only granted per request on accept
      const actor = await actorFor(phone);
      await updateConsents(actor, { termsVersion: CURRENT_TERMS_VERSION, updates: [{ type, channel, granted }] }, "WHATSAPP");
      // A location pin can arrive before consent is recorded; apply it once allowed.
      if (type === "LOCATION_STORAGE" && granted) await applyPendingLocation(phone, actor);
    },
    async createRequest(input: CreateRequestInput) {
      const actor = await actorFor(input.requesterPhone);
      const hospital = await resolveHospital(input.hospitalName);
      if (!hospital) {
        // Not in the directory: tell the family (via the confirmation reply) instead of failing silently.
        const names = (await db.hospital.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 5 })).map((h) => h.name).join(", ");
        return { id: "NOT CREATED", trackUrl: `${appBaseUrl}/request\nWe couldn't match "${input.hospitalName.slice(0, 60)}" to a listed hospital, so nothing was submitted. Type NEED BLOOD and use the full hospital name (e.g. ${names}).` };
      }
      // No deadline given → default to 24 h. UNKNOWN component is stored as UNKNOWN:
      // centre discovery works, but outreach is blocked until staff confirm the component.
      const neededBy = input.neededBy && Date.parse(input.neededBy) > Date.now() ? new Date(input.neededBy).toISOString() : new Date(Date.now() + 24 * 3_600_000).toISOString();
      const key = "wa:" + createHash("sha256").update(`${input.requesterPhone}|${hospital.id}|${input.bloodGroup}|${input.units}|${input.originalText}`).digest("hex").slice(0, 40);
      const { request } = await createBloodRequest(actor, { hospitalId: hospital.id, bloodGroup: input.bloodGroup, component: input.component, units: input.units, neededBy, language: input.language, confirmed: true }, key, { allowUnknownComponent: true });
      return { id: request.id.slice(-8).toUpperCase(), trackUrl: `${appBaseUrl}/track/${request.id}` };
    },
    async updateDonor(phone, data: { bloodGroup?: BloodGroup }) {
      const actor = await actorFor(phone);
      if (!data.bloodGroup) return;
      // WhatsApp sign-up: becomes AVAILABLE only if the donor allowed alerts in this chat.
      const consents = await db.consent.findMany({ where: { userId: actor.userId, requestId: null, type: "URGENT_ALERTS", channel: "WHATSAPP" }, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: 1 });
      const alerts = consents[0]?.granted === true;
      const bloodGroup = data.bloodGroup;
      await db.$transaction(async (tx) => {
        const existing = await tx.donorProfile.findUnique({ where: { userId: actor.userId }, select: { userId: true } });
        await tx.donorProfile.upsert({
          where: { userId: actor.userId },
          create: { userId: actor.userId, bloodGroup, availability: alerts ? "AVAILABLE" : "PAUSED" },
          update: { bloodGroup, ...(alerts ? { availability: "AVAILABLE", unavailableUntil: null, availabilityUpdatedAt: new Date() } : {}) },
        });
        if (!existing) await rewardReferredDonorRegistered(tx, actor.userId);
      });
      await applyPendingLocation(phone, actor);
      await db.auditLog.create({ data: { actorId: actor.userId, action: "DONOR_REGISTERED_WHATSAPP", entity: "DonorProfile", entityId: actor.userId } });
    },
    async updateLocation(phone, location: LocationUpdateDTO) {
      const actor = await actorFor(phone);
      const hasPin = Number.isFinite(location.lat) && Number.isFinite(location.lng) && !(location.lat === 0 && location.lng === 0);
      if (!hasPin) {
        // Typed area: match against seeded areas/hospitals; otherwise keep only the label.
        const area = (location.areaLabel ?? "").trim();
        const hospital = area ? await resolveHospital(area) : null;
        const full = hospital ? await db.hospital.findUnique({ where: { id: hospital.id } }) : null;
        if (!full) return { areaLabel: area || "your area" };
        await storeLocation(phone, actor, { lat: full.lat, lng: full.lng, areaLabel: area, source: "MANUAL_ENTRY" });
        return { areaLabel: `${area} (near ${full.name})` };
      }
      await storeLocation(phone, actor, { lat: location.lat, lng: location.lng, areaLabel: location.areaLabel ?? null, source: location.source === "MANUAL_ENTRY" ? "MANUAL_ENTRY" : "WHATSAPP_SHARE" });
      const c = coarsenCoordinates(location);
      return { areaLabel: location.areaLabel ?? `${c.lat}, ${c.lng}` };
    },
    async respondToInvite(phone, inviteId, response) {
      await respond(phone, inviteId, response);
      void flushOutbox();
    },
    async requestStatus(phone) {
      const user = await db.user.findUnique({ where: { phone } });
      if (!user) return null;
      const latest = await db.bloodRequest.findFirst({ where: { requesterId: user.id }, orderBy: { createdAt: "desc" }, include: { hospital: true } });
      if (!latest) return null;
      return `Request ${latest.id.slice(-8).toUpperCase()} · ${latest.bloodGroup} ${latest.units} unit(s) at ${latest.hospital.name}\nStatus: ${latest.status.replaceAll("_", " ")} · ${latest.verification.replaceAll("_", " ")}\nDonors committed: ${latest.acceptedCount}/${latest.units}\nTrack: ${appBaseUrl}/track/${latest.id}`;
    },
    async requestDeletion(phone) {
      const user = await db.user.findUnique({ where: { phone } });
      if (user) await deleteUserData(user.id);
      await db.botConversation.deleteMany({ where: { phone } });
      erased.add(phone);
    },
  };
}

/** Numbers erased in this process whose next saveState must be skipped (one-shot). */
const erased = new Set<string>();

async function storeLocation(phone: string, actor: ActorContext, loc: { lat: number; lng: number; areaLabel: string | null; source: string }) {
  const db = getDb();
  const profile = await db.donorProfile.findUnique({ where: { userId: actor.userId } });
  const records = await db.consent.findMany({ where: { userId: actor.userId, requestId: null, type: "LOCATION_STORAGE" }, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: 1 });
  const allowed = records[0]?.granted === true;
  if (!profile || !allowed) {
    // Not yet a donor or consent pending: hold it on the conversation, apply later.
    const c = coarsenCoordinates(loc);
    await db.botConversation.upsert({ where: { phone }, update: { pendingLat: c.lat, pendingLng: c.lng, pendingAreaLabel: loc.areaLabel, pendingSource: loc.source }, create: { phone, state: "null", pendingLat: c.lat, pendingLng: c.lng, pendingAreaLabel: loc.areaLabel, pendingSource: loc.source } });
    return;
  }
  const c = coarsenCoordinates(loc);
  const data = { lat: c.lat, lng: c.lng, areaLabel: loc.areaLabel, source: loc.source, updatedAt: new Date() };
  await db.donorLocation.upsert({ where: { userId: actor.userId }, create: { userId: actor.userId, ...data }, update: data });
  await db.auditLog.create({ data: { actorId: actor.userId, action: "DONOR_LOCATION_UPDATED", entity: "DonorProfile", entityId: actor.userId } });
}

async function applyPendingLocation(phone: string, actor: ActorContext) {
  const db = getDb();
  const conv = await db.botConversation.findUnique({ where: { phone } });
  if (!conv || conv.pendingLat === null || conv.pendingLng === null) return;
  const profile = await db.donorProfile.findUnique({ where: { userId: actor.userId } });
  if (!profile) return;
  await storeLocation(phone, actor, { lat: conv.pendingLat, lng: conv.pendingLng, areaLabel: conv.pendingAreaLabel, source: conv.pendingSource ?? "WHATSAPP_SHARE" });
  const stored = await db.donorLocation.findUnique({ where: { userId: actor.userId } });
  if (stored) await db.botConversation.update({ where: { phone }, data: { pendingLat: null, pendingLng: null, pendingAreaLabel: null, pendingSource: null } });
}

/**
 * "DELETE MY DATA": removes identifying data immediately. Requests, events and audit
 * rows stay (they are needed for the case record) but point at an anonymised user.
 */
export async function deleteUserData(userId: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await tx.consent.deleteMany({ where: { userId } });
    await tx.donorProfile.deleteMany({ where: { userId } }); // cascades location
    await tx.session.deleteMany({ where: { userId } });
    await tx.oAuthAccount.deleteMany({ where: { userId } });
    // Rewards: erase balance, ledger, referral links and issued coupon codes.
    await tx.redemption.deleteMany({ where: { userId } });
    await tx.coinEntry.deleteMany({ where: { userId } });
    await tx.wallet.deleteMany({ where: { userId } });
    await tx.referralCode.deleteMany({ where: { userId } });
    await tx.referral.deleteMany({ where: { OR: [{ referredUserId: userId }, { referrerId: userId }] } });
    await tx.notification.updateMany({ where: { userId, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.notification.updateMany({ where: { userId }, data: { toPhone: "deleted", payload: "{}", userId: null } });
    await tx.user.update({ where: { id: userId }, data: { phone: null, email: null, name: "Deleted user" } });
    await tx.auditLog.create({ data: { actorId: userId, action: "USER_DATA_DELETED", entity: "User", entityId: userId } });
  });
}

export { ApiError };
export type { LanguageCode };
