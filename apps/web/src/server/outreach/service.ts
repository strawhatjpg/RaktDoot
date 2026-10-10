/**
 * Verification → matching → waves → invite responses → closed loop.
 * Every state change runs in a transaction, writes a RequestEvent + AuditLog, and
 * queues WhatsApp messages through the outbox (sent after commit).
 */
import {
  canAccessHospitalCases, hasActiveConsent, rankDonors, wavePlan, WAVE_PLAN, ALERT_LOAD_WINDOW_DAYS,
  type ActorContext, type BloodGroup, type DonorCandidateInput, type DonorSex, type FinalOutcome, type MatchCandidateDTO, type OutboundMessage,
} from "@raktdoot/shared";
import type { Prisma, RequestStatus } from "@prisma/client";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";
import { cancelPending, enqueue } from "../notifications/outbox.ts";
import { rewardConfirmedDonation } from "../rewards/service.ts";

type Tx = Prisma.TransactionClient;
const DAY_MS = 86_400_000;
const COMMITTED = ["ACCEPTED", "ARRIVED"] as const;
const COMPONENT_LABEL: Record<string, string> = { WHOLE_BLOOD: "Whole blood", PACKED_RED_CELLS: "Packed red cells", PLATELETS: "Platelets", PLASMA: "Plasma", UNKNOWN: "To be confirmed" };

const isStaff = (a: ActorContext) => a.verified && ["HOSPITAL_STAFF", "BLOOD_CENTRE_STAFF", "COORDINATOR", "ADMIN"].includes(a.role);
const isCoordinator = (a: ActorContext) => a.verified && (a.role === "COORDINATOR" || a.role === "ADMIN");

async function loadScoped(tx: Tx, actor: ActorContext, requestId: string) {
  const row = await tx.bloodRequest.findUnique({ where: { id: requestId }, include: { hospital: true } });
  if (!row || !canAccessHospitalCases(actor, row.hospitalId, row.hospital.district)) throw new ApiError(404, "NOT_FOUND", "Request not found");
  return row;
}

async function event(tx: Tx, requestId: string, actorId: string, from: RequestStatus | null, to: RequestStatus, kind: string, note?: string) {
  await tx.requestEvent.create({ data: { requestId, actorId, fromStatus: from, toStatus: to, kind, note: note?.slice(0, 300) ?? null } });
  await tx.auditLog.create({ data: { actorId, action: kind, entity: "BloodRequest", entityId: requestId } });
}

async function setStatus(tx: Tx, requestId: string, actorId: string, from: RequestStatus, to: RequestStatus, kind: string, note?: string) {
  if (from !== to) await tx.bloodRequest.update({ where: { id: requestId }, data: { status: to } });
  await event(tx, requestId, actorId, from, to, kind, note);
}

// ---------------------------------------------------------------- verification

export async function listVerificationQueue(actor: ActorContext) {
  if (!isStaff(actor)) throw new ApiError(403, "FORBIDDEN", "Verified staff only");
  const scope = actor.role === "ADMIN" ? {} : actor.role === "HOSPITAL_STAFF" && actor.hospitalId ? { hospitalId: actor.hospitalId } : actor.role === "COORDINATOR" && actor.district ? { hospital: { district: actor.district } } : null;
  if (!scope) return [];
  const rows = await getDb().bloodRequest.findMany({
    where: { ...scope, verification: "PENDING_REVIEW", status: { not: "CLOSED" } },
    include: { hospital: true }, orderBy: { neededBy: "asc" }, take: 50,
  });
  return rows.map((r) => ({ id: r.id, hospitalName: r.hospital.name, district: r.hospital.district, bloodGroup: r.bloodGroup, component: r.component, units: r.units, neededBy: r.neededBy.toISOString(), createdAt: r.createdAt.toISOString(), isSimulated: r.isSimulated }));
}

export async function verifyRequest(actor: ActorContext, requestId: string, body: unknown) {
  if (!isStaff(actor)) throw new ApiError(403, "FORBIDDEN", "Verified staff only");
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const decision = b.decision;
  const method = typeof b.method === "string" ? b.method.trim() : "";
  if (decision !== "VERIFIED" && decision !== "REJECTED") throw new ApiError(400, "VALIDATION_ERROR", "decision must be VERIFIED or REJECTED", { decision: "invalid" });
  if (method.length < 3 || method.length > 200) throw new ApiError(400, "VALIDATION_ERROR", "Describe how you checked (3-200 chars), e.g. 'called ward sister'", { method: "invalid" });
  const result = await getDb().$transaction(async (tx) => {
    const row = await loadScoped(tx, actor, requestId);
    if (row.status === "CLOSED") throw new ApiError(409, "REQUEST_CLOSED", "Request is closed");
    if (row.verification === "VERIFIED" || row.verification === "REJECTED") throw new ApiError(409, "ALREADY_DECIDED", `Request is already ${row.verification}`);
    await tx.bloodRequest.update({ where: { id: row.id }, data: { verification: decision, verifiedById: actor.userId, verifiedAt: new Date() } });
    await event(tx, row.id, actor.userId, row.status, row.status, decision === "VERIFIED" ? "REQUEST_VERIFIED" : "REQUEST_REJECTED", method);
    if (decision === "REJECTED") {
      await setStatus(tx, row.id, actor.userId, row.status, "CLOSED", "REQUEST_CLOSED", "Rejected at verification");
      await tx.bloodRequest.update({ where: { id: row.id }, data: { outcome: "UNRESOLVED" } });
    }
    return { id: row.id, verification: decision };
  });
  return result;
}

// ---------------------------------------------------------------- matching

async function loadCandidates(tx: Tx, request: { id: string; bloodGroup: string; requesterId: string }, now: Date): Promise<DonorCandidateInput[]> {
  const profiles = await tx.donorProfile.findMany({ where: { bloodGroup: request.bloodGroup }, include: { location: true, user: { select: { id: true, name: true } } }, take: 2000 });
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => p.userId);
  const [consents, invites, recent] = await Promise.all([
    tx.consent.findMany({ where: { userId: { in: ids }, requestId: null, type: { in: ["TERMS", "URGENT_ALERTS"] } }, orderBy: [{ recordedAt: "asc" }, { id: "asc" }] }),
    tx.outreachInvite.findMany({ where: { donorId: { in: ids }, OR: [{ requestId: request.id }, { status: { in: [...COMMITTED] }, request: { status: { not: "CLOSED" } } }] }, select: { donorId: true, requestId: true, status: true } }),
    tx.outreachInvite.groupBy({ by: ["donorId"], where: { donorId: { in: ids }, createdAt: { gte: new Date(now.getTime() - ALERT_LOAD_WINDOW_DAYS * DAY_MS) } }, _count: { _all: true } }),
  ]);
  const byUser = new Map<string, typeof consents>();
  for (const c of consents) (byUser.get(c.userId) ?? byUser.set(c.userId, []).get(c.userId)!).push(c);
  const recentByUser = new Map(recent.map((r) => [r.donorId, r._count._all]));
  return profiles.map((p): DonorCandidateInput => {
    const records = (byUser.get(p.userId) ?? []).map((c) => ({ type: c.type, channel: c.channel, granted: c.granted, recordedAt: c.recordedAt, sequence: c.id }));
    // Alerts go out on WhatsApp in this build; consent for that exact channel is required.
    const consent = hasActiveConsent(records, "TERMS") && hasActiveConsent(records, "URGENT_ALERTS", "WHATSAPP");
    return {
      donorId: p.userId, displayName: p.user.name.split(/\s+/)[0] ?? "Donor", bloodGroup: p.bloodGroup as BloodGroup, sex: p.sex as DonorSex,
      availability: p.availability, unavailableUntil: p.unavailableUntil, availabilityUpdatedAt: p.availabilityUpdatedAt,
      travelRadiusKm: p.travelRadiusKm, lastDonationAt: p.lastDonationAt,
      location: p.location ? { lat: p.location.lat, lng: p.location.lng, updatedAt: p.location.updatedAt } : null,
      hasAlertConsent: consent,
      committedElsewhere: invites.some((i) => i.donorId === p.userId && i.requestId !== request.id && (COMMITTED as readonly string[]).includes(i.status)),
      alreadyInvited: invites.some((i) => i.donorId === p.userId && i.requestId === request.id),
      isRequester: p.userId === request.requesterId,
      alertsLast14Days: recentByUser.get(p.userId) ?? 0,
    };
  });
}

export async function previewMatches(actor: ActorContext, requestId: string, waveNumber = 1): Promise<{ candidates: MatchCandidateDTO[]; excluded: Record<string, number>; radiusKm: number }> {
  if (!isStaff(actor)) throw new ApiError(403, "FORBIDDEN", "Verified staff only");
  const plan = wavePlan(waveNumber) ?? WAVE_PLAN[0];
  return getDb().$transaction(async (tx) => {
    const row = await loadScoped(tx, actor, requestId);
    const now = new Date();
    const { eligible, excluded } = rankDonors(await loadCandidates(tx, row, now), { bloodGroup: row.bloodGroup as BloodGroup, component: row.component, hospital: row.hospital, maxRadiusKm: plan.radiusKm }, now);
    return { candidates: eligible.slice(0, plan.size).map(({ donorId, displayName, distanceKm, score, reasons }) => ({ donorId, displayName, distanceKm, score, reasons })), excluded, radiusKm: plan.radiusKm };
  });
}

// ---------------------------------------------------------------- waves

function inviteMessage(to: string, inviteId: string, r: { bloodGroup: string; component: string; units: number; neededBy: Date; hospital: { name: string; district: string } }): OutboundMessage {
  const by = r.neededBy.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return {
    to, kind: "buttons",
    text: `🩸 RaktDoot: urgent request near you\n${r.bloodGroup} · ${COMPONENT_LABEL[r.component] ?? r.component} · ${r.units} unit(s)\n🏥 ${r.hospital.name}, ${r.hospital.district}\n⏰ Needed by ${by}\n\nThis request was verified by hospital staff or a coordinator. You would donate only at a licensed blood centre, where staff confirm eligibility. Can you help?`,
    buttons: [
      { id: `invite:${inviteId}:accept`, title: "Accept" },
      { id: `invite:${inviteId}:decline`, title: "Ignore" },
      { id: `invite:${inviteId}:pause`, title: "Pause alerts" },
    ],
  };
}

/** Starts the next wave for a verified request. Idempotent per wave number. */
export async function startWave(actor: ActorContext, requestId: string) {
  if (!isCoordinator(actor) && !(actor.verified && actor.role === "HOSPITAL_STAFF")) throw new ApiError(403, "FORBIDDEN", "Coordinators or hospital staff only");
  return getDb().$transaction(async (tx) => {
    const row = await loadScoped(tx, actor, requestId);
    if (row.verification !== "VERIFIED") throw new ApiError(409, "NOT_VERIFIED", "Private donors are contacted only for verified requests");
    if (row.status === "CLOSED") throw new ApiError(409, "REQUEST_CLOSED", "Request is closed");
    if (row.component === "UNKNOWN") throw new ApiError(409, "COMPONENT_UNKNOWN", "Confirm the component before contacting donors");
    if (row.acceptedCount >= row.units) throw new ApiError(409, "ENOUGH_DONORS", "Enough donors have already accepted");
    const last = await tx.outreachWave.findFirst({ where: { requestId }, orderBy: { waveNumber: "desc" } });
    const plan = wavePlan((last?.waveNumber ?? 0) + 1);
    if (!plan) throw new ApiError(409, "WAVES_EXHAUSTED", "All automatic waves used; escalate to partner NGOs and the coordinator");
    const now = new Date();
    const { eligible, excluded } = rankDonors(await loadCandidates(tx, row, now), { bloodGroup: row.bloodGroup as BloodGroup, component: row.component, hospital: row.hospital, maxRadiusKm: plan.radiusKm }, now);
    const chosen = eligible.slice(0, plan.size);
    const wave = await tx.outreachWave.create({ data: { requestId, waveNumber: plan.waveNumber, radiusKm: plan.radiusKm, size: chosen.length, startedById: actor.userId, closesAt: new Date(now.getTime() + plan.windowMinutes * 60_000) } });
    const phones = new Map((await tx.user.findMany({ where: { id: { in: chosen.map((c) => c.donorId) } }, select: { id: true, phone: true } })).map((u) => [u.id, u.phone]));
    let queued = 0;
    for (const c of chosen) {
      const invite = await tx.outreachInvite.create({ data: { waveId: wave.id, requestId, donorId: c.donorId, score: c.score, distanceKm: c.distanceKm, reasons: JSON.stringify(c.reasons) } });
      const phone = phones.get(c.donorId);
      if (phone) {
        await enqueue(tx, { userId: c.donorId, toPhone: phone, purpose: "URGENT_ALERT", message: inviteMessage(phone, invite.id, row), dedupeKey: `invite:${invite.id}`, requestId, inviteId: invite.id });
        queued++;
      }
    }
    if (row.status !== "OUTREACH_ACTIVE" && row.status !== "DONOR_ACCEPTED") {
      await setStatus(tx, requestId, actor.userId, row.status, "OUTREACH_ACTIVE", "WAVE_STARTED", `Wave ${plan.waveNumber}: ${chosen.length} donor(s) within ${plan.radiusKm} km`);
    } else {
      await event(tx, requestId, actor.userId, row.status, row.status, "WAVE_STARTED", `Wave ${plan.waveNumber}: ${chosen.length} donor(s) within ${plan.radiusKm} km`);
    }
    return { waveId: wave.id, waveNumber: plan.waveNumber, radiusKm: plan.radiusKm, invited: chosen.length, messagesQueued: queued, excluded, closesAt: wave.closesAt.toISOString() };
  });
}

/** Stand-down: cancel unsent invites and tell still-pending donors they are no longer needed. */
async function standDown(tx: Tx, requestId: string, reason: string) {
  await cancelPending(tx, { requestId, purpose: "URGENT_ALERT" });
  const pending = await tx.outreachInvite.findMany({ where: { requestId, status: "INVITED" }, include: { donor: { select: { phone: true } } } });
  for (const inv of pending) {
    await tx.outreachInvite.update({ where: { id: inv.id }, data: { status: "STOOD_DOWN" } });
    const sent = await tx.notification.count({ where: { inviteId: inv.id, purpose: "URGENT_ALERT", status: { in: ["SENT", "SIMULATED", "SENDING"] } } });
    if (sent > 0 && inv.donor.phone) {
      await enqueue(tx, { userId: inv.donorId, toPhone: inv.donor.phone, purpose: "STAND_DOWN", message: { to: inv.donor.phone, kind: "text", text: `RaktDoot: thank you — the request you were alerted about ${reason}. No action is needed.` }, dedupeKey: `standdown:${inv.id}`, requestId, inviteId: inv.id });
    }
  }
  await tx.outreachWave.updateMany({ where: { requestId, closedAt: null }, data: { closedAt: new Date() } });
}

export type InviteResponse = "ACCEPT" | "DECLINE" | "PAUSE";

/**
 * Donor reply from WhatsApp. The phone must own the invite. Acceptance claims a
 * slot atomically (acceptedCount < units), so two simultaneous accepts can never
 * over-commit a request; a late accept is told politely that enough donors replied.
 */
export async function respondToInvite(phone: string, inviteId: string, response: InviteResponse): Promise<{ outcome: "ACCEPTED" | "DECLINED" | "PAUSED" | "FULL" | "CLOSED" | "NOT_FOUND" | "ALREADY" }> {
  return getDb().$transaction(async (tx) => {
    const invite = await tx.outreachInvite.findUnique({ where: { id: inviteId }, include: { donor: true, request: { include: { hospital: true } } } });
    if (!invite || invite.donor.phone !== phone) return { outcome: "NOT_FOUND" as const };
    if (invite.status !== "INVITED") return { outcome: "ALREADY" as const };
    const req = invite.request;
    const now = new Date();
    if (response === "PAUSE") {
      await tx.outreachInvite.update({ where: { id: invite.id }, data: { status: "PAUSED", respondedAt: now } });
      await tx.donorProfile.updateMany({ where: { userId: invite.donorId }, data: { availability: "PAUSED", unavailableUntil: null, availabilityUpdatedAt: now } });
      await tx.auditLog.create({ data: { actorId: invite.donorId, action: "INVITE_PAUSED", entity: "OutreachInvite", entityId: invite.id } });
      return { outcome: "PAUSED" as const };
    }
    if (response === "DECLINE") {
      await tx.outreachInvite.update({ where: { id: invite.id }, data: { status: "DECLINED", respondedAt: now } });
      await tx.auditLog.create({ data: { actorId: invite.donorId, action: "INVITE_DECLINED", entity: "OutreachInvite", entityId: invite.id } });
      return { outcome: "DECLINED" as const };
    }
    if (req.status === "CLOSED") {
      await tx.outreachInvite.update({ where: { id: invite.id }, data: { status: "STOOD_DOWN", respondedAt: now } });
      return { outcome: "CLOSED" as const };
    }
    const claim = await tx.bloodRequest.updateMany({ where: { id: req.id, status: { not: "CLOSED" }, acceptedCount: { lt: req.units } }, data: { acceptedCount: { increment: 1 } } });
    if (claim.count === 0) {
      await tx.outreachInvite.update({ where: { id: invite.id }, data: { status: "STOOD_DOWN", respondedAt: now } });
      return { outcome: "FULL" as const };
    }
    await tx.outreachInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", respondedAt: now } });
    // Request-scoped contact sharing, granted by the act of accepting (never global).
    await tx.consent.create({ data: { userId: invite.donorId, type: "CONTACT_SHARING", channel: "WHATSAPP", requestId: req.id, granted: true, source: "WHATSAPP", termsVersion: "invite-accept" } });
    const fresh = await tx.bloodRequest.findUniqueOrThrow({ where: { id: req.id } });
    await setStatus(tx, req.id, invite.donorId, fresh.status, fresh.status === "OUTREACH_ACTIVE" || fresh.status === "STOCK_CONFIRMED" || fresh.status === "CENTRES_LISTED" || fresh.status === "OPEN" ? "DONOR_ACCEPTED" : fresh.status, "DONOR_ACCEPTED", `${fresh.acceptedCount}/${fresh.units} donor(s) committed`);
    if (fresh.acceptedCount >= fresh.units) await standDown(tx, req.id, "now has enough donors");
    if (invite.donor.phone) {
      const centre = await tx.bloodCentre.findFirst({ where: { district: req.hospital.district }, orderBy: { id: "asc" } });
      await enqueue(tx, {
        userId: invite.donorId, toPhone: invite.donor.phone, purpose: "STATUS_UPDATE",
        message: { to: invite.donor.phone, kind: "text", text: `✅ Thank you! Request ID: ${req.id.slice(-8).toUpperCase()}\nPlease go to the hospital's blood centre (${req.hospital.name})${centre ? ` or ${centre.name}` : ""} and quote this ID. Carry a photo ID. Blood-centre staff will confirm you can donate today.` },
        dedupeKey: `accepted:${invite.id}`, requestId: req.id, inviteId: invite.id,
      });
    }
    return { outcome: "ACCEPTED" as const };
  });
}

/** Closes waves whose window passed; the coordinator decides whether to start the next one. */
export async function expireWaves(now = new Date()): Promise<number> {
  return getDb().$transaction(async (tx) => {
    const due = await tx.outreachWave.findMany({ where: { closedAt: null, closesAt: { lte: now } }, select: { id: true } });
    for (const w of due) {
      await tx.outreachInvite.updateMany({ where: { waveId: w.id, status: "INVITED" }, data: { status: "EXPIRED" } });
      await tx.outreachWave.update({ where: { id: w.id }, data: { closedAt: now } });
    }
    return due.length;
  });
}

// ---------------------------------------------------------------- closed loop

const CENTRE_CONFIRMERS = ["BLOOD_CENTRE_STAFF", "COORDINATOR", "ADMIN"];

/** Staff record what happened to a committed donor: ARRIVED, DONATED, DEFERRED or NO_SHOW. */
export async function recordDonorOutcome(actor: ActorContext, inviteId: string, body: unknown) {
  if (!isStaff(actor)) throw new ApiError(403, "FORBIDDEN", "Verified staff only");
  const outcome = (body as { outcome?: unknown } | null)?.outcome;
  if (!["ARRIVED", "DONATED", "DEFERRED", "NO_SHOW"].includes(outcome as string)) throw new ApiError(400, "VALIDATION_ERROR", "outcome must be ARRIVED, DONATED, DEFERRED or NO_SHOW", { outcome: "invalid" });
  if ((outcome === "DONATED" || outcome === "DEFERRED") && !CENTRE_CONFIRMERS.includes(actor.role)) throw new ApiError(403, "FORBIDDEN", "Blood-centre staff or a coordinator confirms donation and deferral");
  return getDb().$transaction(async (tx) => {
    const invite = await tx.outreachInvite.findUnique({ where: { id: inviteId }, include: { donor: true } });
    if (!invite) throw new ApiError(404, "NOT_FOUND", "Invite not found");
    const row = await loadScoped(tx, actor, invite.requestId);
    const now = new Date();
    const allowed: Record<string, string[]> = { ARRIVED: ["ACCEPTED"], DONATED: ["ACCEPTED", "ARRIVED"], DEFERRED: ["ACCEPTED", "ARRIVED"], NO_SHOW: ["ACCEPTED", "ARRIVED"] };
    if (!allowed[outcome as string]!.includes(invite.status)) throw new ApiError(409, "INVALID_TRANSITION", `Cannot record ${outcome as string} for an invite that is ${invite.status}`);
    if (outcome === "ARRIVED") {
      await tx.outreachInvite.update({ where: { id: invite.id }, data: { status: "ARRIVED", arrivedAt: now } });
      await setStatus(tx, row.id, actor.userId, row.status, row.status === "CLOSED" ? row.status : "DONOR_ARRIVED", "DONOR_ARRIVED");
      return { status: "ARRIVED" };
    }
    if (outcome === "DONATED") {
      await tx.outreachInvite.update({ where: { id: invite.id }, data: { status: "DONATED", donatedAt: now } });
      await tx.donorProfile.updateMany({ where: { userId: invite.donorId }, data: { lastDonationAt: now, lastDonationSource: "CENTRE_CONFIRMED" } });
      await setStatus(tx, row.id, actor.userId, row.status, row.status === "CLOSED" ? row.status : "DONATION_CONFIRMED", "DONATION_CONFIRMED");
      const award = await tx.recognitionAward.upsert({
        where: { inviteId: invite.id }, update: {},
        create: { userId: invite.donorId, kind: "CERTIFICATE", inviteId: invite.id, code: `RD-${invite.id.slice(-10).toUpperCase()}` },
      });
      // Coins only for a centre-confirmed donation (never for accepting an alert).
      const coins = await rewardConfirmedDonation(tx, invite.donorId, invite.id);
      if (invite.donor.phone) {
        const coinLine = coins > 0 ? ` You also earned ${coins} RaktDoot coins for sponsor rewards: ${process.env.APP_BASE_URL ?? ""}/rewards` : "";
        await enqueue(tx, { userId: invite.donorId, toPhone: invite.donor.phone, purpose: "RECOGNITION", message: { to: invite.donor.phone, kind: "text", text: `🏅 Thank you for donating! Your RaktDoot certificate code is ${award.code}.${coinLine} We'll remind you when you may be eligible again (only if you allowed reminders).` }, dedupeKey: `award:${award.id}` });
      }
      return { status: "DONATED", certificate: award.code, coins };
    }
    // DEFERRED / NO_SHOW free the slot so outreach can continue.
    await tx.outreachInvite.update({ where: { id: invite.id }, data: { status: outcome === "DEFERRED" ? "DEFERRED" : "WITHDRAWN" } });
    await tx.bloodRequest.update({ where: { id: row.id }, data: { acceptedCount: { decrement: 1 } } });
    if (row.status !== "CLOSED") await setStatus(tx, row.id, actor.userId, row.status, "OUTREACH_ACTIVE", outcome === "DEFERRED" ? "DONOR_DEFERRED" : "DONOR_NO_SHOW");
    return { status: outcome };
  });
}

/** Units issued to the patient. Recorded by blood-centre staff or a coordinator. */
export async function recordFulfilment(actor: ActorContext, requestId: string, body: unknown) {
  if (!actor.verified || !CENTRE_CONFIRMERS.includes(actor.role)) throw new ApiError(403, "FORBIDDEN", "Blood-centre staff or a coordinator records issued units");
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const units = b.units;
  const source = b.source;
  if (typeof units !== "number" || !Number.isSafeInteger(units) || units < 1 || units > 100) throw new ApiError(400, "VALIDATION_ERROR", "units must be 1-100", { units: "invalid" });
  if (source !== "DONOR_DONATION" && source !== "CENTRE_STOCK") throw new ApiError(400, "VALIDATION_ERROR", "source must be DONOR_DONATION or CENTRE_STOCK", { source: "invalid" });
  return getDb().$transaction(async (tx) => {
    const row = await loadScoped(tx, actor, requestId);
    if (row.status === "CLOSED") throw new ApiError(409, "REQUEST_CLOSED", "Request is closed");
    await tx.fulfilmentRecord.create({ data: { requestId, units, source, recordedById: actor.userId, note: typeof b.note === "string" ? b.note.slice(0, 300) : null } });
    await event(tx, requestId, actor.userId, row.status, row.status, "UNITS_ISSUED", `${units} unit(s) from ${source === "CENTRE_STOCK" ? "centre stock" : "donor donation"}`);
    const issued = (await tx.fulfilmentRecord.aggregate({ where: { requestId }, _sum: { units: true } }))._sum.units ?? 0;
    return { issuedUnits: issued, requiredUnits: row.units };
  });
}

/**
 * Close with an outcome. FULFILLED requires recorded issued units >= requested.
 * Requesters may only cancel their own request. Always stands down pending donors.
 */
export async function closeRequest(actor: ActorContext, requestId: string, body: unknown) {
  const outcome = (body as { outcome?: unknown } | null)?.outcome as FinalOutcome;
  if (!["FULFILLED", "CANCELLED", "EXPIRED", "UNRESOLVED"].includes(outcome)) throw new ApiError(400, "VALIDATION_ERROR", "outcome must be FULFILLED, CANCELLED, EXPIRED or UNRESOLVED", { outcome: "invalid" });
  return getDb().$transaction(async (tx) => {
    const row = await tx.bloodRequest.findUnique({ where: { id: requestId }, include: { hospital: true } });
    const owner = row?.requesterId === actor.userId;
    if (!row || (!owner && !canAccessHospitalCases(actor, row.hospitalId, row.hospital.district))) throw new ApiError(404, "NOT_FOUND", "Request not found");
    const staff = isStaff(actor) && canAccessHospitalCases(actor, row.hospitalId, row.hospital.district);
    if (!staff && !(owner && outcome === "CANCELLED")) throw new ApiError(403, "FORBIDDEN", "Requesters may only cancel their own request");
    if (row.status === "CLOSED") throw new ApiError(409, "REQUEST_CLOSED", "Request is already closed");
    if (outcome === "FULFILLED") {
      const issued = (await tx.fulfilmentRecord.aggregate({ where: { requestId }, _sum: { units: true } }))._sum.units ?? 0;
      if (issued < row.units) throw new ApiError(409, "NOT_FULFILLED", `Only ${issued}/${row.units} unit(s) recorded as issued. Record issued units first.`);
    }
    await standDown(tx, row.id, outcome === "FULFILLED" ? "has been fulfilled" : "is no longer active");
    await tx.bloodRequest.update({ where: { id: row.id }, data: { outcome } });
    await setStatus(tx, row.id, actor.userId, row.status, "CLOSED", "REQUEST_CLOSED", outcome);
    return { id: row.id, status: "CLOSED", outcome };
  });
}

export async function caseOutreach(actor: ActorContext, requestId: string) {
  if (!isStaff(actor)) throw new ApiError(403, "FORBIDDEN", "Verified staff only");
  return getDb().$transaction(async (tx) => {
    const row = await loadScoped(tx, actor, requestId);
    const [waves, invites, fulfilment] = await Promise.all([
      tx.outreachWave.findMany({ where: { requestId }, orderBy: { waveNumber: "asc" } }),
      tx.outreachInvite.findMany({ where: { requestId }, include: { donor: { select: { name: true } } }, orderBy: [{ score: "desc" }, { id: "asc" }] }),
      tx.fulfilmentRecord.aggregate({ where: { requestId }, _sum: { units: true } }),
    ]);
    return {
      requestId, status: row.status, verification: row.verification, units: row.units, acceptedCount: row.acceptedCount, issuedUnits: fulfilment._sum.units ?? 0,
      waves: waves.map((w) => ({ waveNumber: w.waveNumber, radiusKm: w.radiusKm, size: w.size, startedAt: w.startedAt.toISOString(), closesAt: w.closesAt.toISOString(), closed: w.closedAt !== null })),
      // First name only; phone numbers are never returned (contact sharing is per request and handled by staff).
      invites: invites.map((i) => ({ inviteId: i.id, displayName: i.donor.name.split(/\s+/)[0], distanceKm: i.distanceKm, score: i.score, reasons: JSON.parse(i.reasons) as string[], status: i.status, respondedAt: i.respondedAt?.toISOString() ?? null })),
    };
  });
}