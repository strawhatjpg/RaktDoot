/**
 * Background worker: one loop, three jobs.
 *  1. Close expired outreach waves (pending invites → EXPIRED).
 *  2. Queue due donation reminders (consent re-checked each time).
 *  3. Deliver the notification outbox (retries up to 3 attempts).
 * State lives in the database, so restarting the worker loses nothing.
 * Run: npm run worker   (or once: npm run worker -- --once)
 */
import { expireWaves } from "../src/server/outreach/service.ts";
import { queueDueReminders } from "../src/server/reminders/service.ts";
import { dispatchPending } from "../src/server/notifications/outbox.ts";
import { whatsappSender } from "../src/server/notifications/sender.ts";
import { getDb } from "../src/server/db.ts";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 15_000);
const once = process.argv.includes("--once");
let stopping = false;

async function tick(): Promise<void> {
  const waves = await expireWaves();
  const reminders = await queueDueReminders();
  const sent = await dispatchPending(whatsappSender());
  if (waves || reminders || sent.sent || sent.simulated || sent.failed) {
    console.log(`[worker] waves closed=${waves} reminders queued=${reminders} sent=${sent.sent} simulated=${sent.simulated} failed=${sent.failed}`);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { stopping = true; });

try {
  console.log(`[worker] started (${whatsappSender() ? "WhatsApp delivery ON" : "simulated delivery — WhatsApp not configured"})`);
  do {
    try { await tick(); }
    catch (error) { console.error("[worker] tick failed", error instanceof Error ? error.name : "UnknownError"); }
    if (!once && !stopping) await new Promise((r) => setTimeout(r, INTERVAL_MS));
  } while (!once && !stopping);
} finally {
  await getDb().$disconnect();
}