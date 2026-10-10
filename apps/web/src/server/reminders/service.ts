/**
 * Donation reminders. A donor gets one reminder per eligibility date, only if they
 * consented to reminders on WhatsApp and the provisional interval has passed.
 * Wording is always "you may be eligible", never "you are eligible".
 * Consent and donation history are re-checked at send time (here), not when queued.
 */
import { hasActiveConsent, provisionalNextEligibleDate, type DonorSex } from "@raktdoot/shared";
import { getDb } from "../db.ts";
import { enqueue } from "../notifications/outbox.ts";

export async function queueDueReminders(now: Date = new Date()): Promise<number> {
  const db = getDb();
  const donors = await db.donorProfile.findMany({ where: { lastDonationAt: { not: null } }, include: { user: { select: { id: true, phone: true } } }, take: 5000 });
  let queued = 0;
  for (const d of donors) {
    if (!d.lastDonationAt || !d.user.phone) continue;
    const dueAt = provisionalNextEligibleDate(d.lastDonationAt, d.sex as DonorSex);
    if (dueAt.getTime() > now.getTime()) continue;
    const consents = await db.consent.findMany({ where: { userId: d.userId, requestId: null, type: { in: ["TERMS", "DONATION_REMINDERS"] } } });
    const records = consents.map((c) => ({ type: c.type, channel: c.channel, granted: c.granted, recordedAt: c.recordedAt, sequence: c.id }));
    if (!hasActiveConsent(records, "TERMS") || !hasActiveConsent(records, "DONATION_REMINDERS", "WHATSAPP")) continue;
    const created = await db.$transaction(async (tx) => {
      const exists = await tx.reminderLog.findUnique({ where: { userId_dueAt: { userId: d.userId, dueAt } } });
      if (exists) return false;
      const phone = d.user.phone!;
      const n = await enqueue(tx, {
        userId: d.userId, toPhone: phone, purpose: "REMINDER", dedupeKey: `reminder:${d.userId}:${dueAt.toISOString()}`,
        message: { to: phone, kind: "text", text: "🩸 RaktDoot: it has been a while since your last donation — you may be eligible to donate again. The blood centre will confirm on the day. Reply STOP to stop reminders." },
      });
      await tx.reminderLog.create({ data: { userId: d.userId, dueAt, notificationId: n.id } });
      return true;
    });
    if (created) queued++;
  }
  return queued;
}