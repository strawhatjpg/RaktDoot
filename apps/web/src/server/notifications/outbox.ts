/**
 * Durable notification outbox. Writers enqueue inside their DB transaction; a
 * dispatcher (worker or inline after commit) sends. Every row has a dedupe key so a
 * retried action can never message the same person twice for the same purpose.
 *
 * Delivery modes:
 *  - WhatsApp configured (WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN): real send.
 *  - Otherwise: marked SIMULATED and visible in the demo inbox (/api/demo/inbox).
 *  - Users seeded as isSimulated are ALWAYS simulated, so fictional numbers are never messaged.
 */
import type { OutboundMessage } from "@raktdoot/shared";
import type { Prisma } from "@prisma/client";
import { getDb } from "../db.ts";

type Tx = Prisma.TransactionClient;
export type NotificationPurpose = "URGENT_ALERT" | "STAND_DOWN" | "STATUS_UPDATE" | "REMINDER" | "RECOGNITION" | "BOT_REPLY";

export interface EnqueueInput {
  userId: string | null;
  toPhone: string;
  purpose: NotificationPurpose;
  message: OutboundMessage;
  dedupeKey: string;
  requestId?: string;
  inviteId?: string;
}

/** Idempotent: an existing dedupe key returns the earlier row instead of a duplicate. */
export async function enqueue(tx: Tx, input: EnqueueInput): Promise<{ id: string; created: boolean }> {
  const existing = await tx.notification.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  const row = await tx.notification.create({
    data: {
      userId: input.userId, toPhone: input.toPhone, channel: "WHATSAPP", purpose: input.purpose,
      payload: JSON.stringify({ ...input.message, to: input.toPhone }), dedupeKey: input.dedupeKey,
      requestId: input.requestId ?? null, inviteId: input.inviteId ?? null,
    },
    select: { id: true },
  });
  return { id: row.id, created: true };
}

export type Sender = (message: OutboundMessage) => Promise<{ ok: boolean; messageId?: string; error?: string }>;

const MAX_ATTEMPTS = 3;

/**
 * Claims pending rows one at a time (PENDING → SENDING via conditional update, so two
 * dispatchers cannot send the same row) and delivers them. Returns counts.
 */
export async function dispatchPending(sender: Sender | null, limit = 50): Promise<{ sent: number; simulated: number; failed: number }> {
  const db = getDb();
  const counts = { sent: 0, simulated: 0, failed: 0 };
  const rows = await db.notification.findMany({
    where: { status: "PENDING" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit,
    include: { user: { select: { isSimulated: true } } },
  });
  for (const row of rows) {
    const claim = await db.notification.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "SENDING", attempts: { increment: 1 } } });
    if (claim.count === 0) continue;
    const simulatedRecipient = row.user?.isSimulated === true;
    if (!sender || simulatedRecipient) {
      await db.notification.update({ where: { id: row.id }, data: { status: "SIMULATED", sentAt: new Date() } });
      counts.simulated++;
      continue;
    }
    const result = await sender(JSON.parse(row.payload) as OutboundMessage).catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : "send failed" }));
    if (result.ok) {
      await db.notification.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), providerMessageId: "messageId" in result ? result.messageId ?? null : null, lastError: null } });
      counts.sent++;
    } else {
      const attempts = row.attempts + 1;
      // Provider error text is stored truncated; it never contains message bodies.
      await db.notification.update({ where: { id: row.id }, data: { status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING", lastError: (result.error ?? "send failed").slice(0, 200) } });
      counts.failed++;
    }
  }
  return counts;
}

/** Cancel queued (not yet sent) messages, e.g. invites when a request closes. */
export async function cancelPending(tx: Tx, where: { requestId?: string; inviteId?: string; purpose?: NotificationPurpose }): Promise<number> {
  const { count } = await tx.notification.updateMany({ where: { ...where, status: "PENDING" }, data: { status: "CANCELLED" } });
  return count;
}