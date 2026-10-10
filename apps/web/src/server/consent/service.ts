import {
  CURRENT_TERMS_VERSION, hasActiveConsent, validateConsentUpdate,
  type ActorContext, type ConsentRecord, type ConsentStateDTO, type ConsentType, type ConsentUpdateItem, type NotificationChannel,
} from "@raktdoot/shared";
import type { Prisma } from "@prisma/client";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";

/** Set by server code from the channel the user actually used, never from the request body. */
export type ConsentSource = "APP" | "WHATSAPP";
type Tx = Prisma.TransactionClient;
type LatestConsent = { type: ConsentType; channel: NotificationChannel | null; granted: boolean; recordedAt: Date; termsVersion: string };

const keyOf = (type: string, channel: string | null) => `${type}:${channel ?? "-"}`;

/** Global (not request-scoped) consent history, ordered so that the last entry per key wins. */
export async function loadConsents(tx: Tx, userId: string): Promise<{ records: ConsentRecord[]; latest: Map<string, LatestConsent> }> {
  const rows = await tx.consent.findMany({ where: { userId, requestId: null }, orderBy: [{ recordedAt: "asc" }, { id: "asc" }] });
  const latest = new Map<string, LatestConsent>();
  for (const row of rows) latest.set(keyOf(row.type, row.channel), { type: row.type, channel: row.channel, granted: row.granted, recordedAt: row.recordedAt, termsVersion: row.termsVersion });
  return { records: rows.map((row) => ({ type: row.type, channel: row.channel, granted: row.granted, recordedAt: row.recordedAt, sequence: row.id })), latest };
}

export async function getConsentState(actor: ActorContext): Promise<ConsentStateDTO> {
  const { latest } = await loadConsents(getDb(), actor.userId);
  return {
    currentTermsVersion: CURRENT_TERMS_VERSION,
    consents: [...latest.values()].map((c) => ({ type: c.type, channel: c.channel, granted: c.granted, recordedAt: c.recordedAt.toISOString(), termsVersion: c.termsVersion })),
  };
}

/**
 * Appends consent records for changed values only. Rules:
 * - The client must echo the terms version it displayed; stale notices are rejected.
 * - Other purposes require accepted terms (in this batch or already active).
 * - Withdrawing terms withdraws every purpose, deletes the stored location and pauses alerts.
 * - Withdrawing location storage deletes the stored location.
 */
export async function updateConsents(actor: ActorContext, body: unknown, source: ConsentSource): Promise<ConsentStateDTO> {
  const parsed = validateConsentUpdate(body);
  if (!parsed.ok) throw new ApiError(400, "VALIDATION_ERROR", "Check the consent fields", parsed.fields);
  if (parsed.value.termsVersion !== CURRENT_TERMS_VERSION) {
    throw new ApiError(409, "TERMS_VERSION_CHANGED", "The terms have changed. Show the current notice and ask again.");
  }
  const updates = parsed.value.updates;
  await getDb().$transaction(async (tx) => {
    const { records, latest } = await loadConsents(tx, actor.userId);
    const termsUpdate = updates.find((u) => u.type === "TERMS");
    const termsActiveAfter = termsUpdate ? termsUpdate.granted : hasActiveConsent(records, "TERMS");
    if (updates.some((u) => u.type !== "TERMS" && u.granted) && !termsActiveAfter) {
      throw new ApiError(409, "TERMS_REQUIRED", "Accept the terms before granting other permissions");
    }
    const writes: ConsentUpdateItem[] = [...updates];
    if (termsUpdate && !termsUpdate.granted) {
      for (const c of latest.values()) {
        if (c.type === "TERMS" || c.type === "CONTACT_SHARING" || !c.granted) continue;
        if (!writes.some((w) => w.type === c.type && w.channel === c.channel)) writes.push({ type: c.type, channel: c.channel, granted: false });
      }
    }
    const now = new Date();
    const data = writes
      .filter((w) => {
        const current = latest.get(keyOf(w.type, w.channel));
        // Re-record an unchanged grant only when it was given under an older notice.
        return !current || current.granted !== w.granted || (w.granted && current.termsVersion !== CURRENT_TERMS_VERSION);
      })
      .map((w) => ({ userId: actor.userId, type: w.type, channel: w.channel, granted: w.granted, source, termsVersion: CURRENT_TERMS_VERSION, recordedAt: now }));
    if (data.length === 0) return;
    await tx.consent.createMany({ data });
    const locationRevoked = writes.some((w) => w.type === "LOCATION_STORAGE" && !w.granted);
    if (locationRevoked) await tx.donorLocation.deleteMany({ where: { userId: actor.userId } });
    if (termsUpdate && !termsUpdate.granted) {
      await tx.donorProfile.updateMany({ where: { userId: actor.userId }, data: { availability: "PAUSED", unavailableUntil: null, availabilityUpdatedAt: now } });
    }
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "CONSENT_UPDATED", entity: "User", entityId: actor.userId } });
  });
  return getConsentState(actor);
}