import type { ConsentType, NotificationChannel } from "./constants.ts";

export interface ConsentRecord {
  type: ConsentType;
  /** Channel the consent applies to; null means channel-independent (e.g. TERMS). */
  channel: NotificationChannel | null;
  granted: boolean;
  recordedAt: Date;
}

/**
 * Latest record for the given type/channel wins, so a later withdrawal
 * overrides an earlier grant (and vice versa).
 */
export function hasActiveConsent(
  records: readonly ConsentRecord[],
  type: ConsentType,
  channel: NotificationChannel | null = null,
): boolean {
  let latest: ConsentRecord | undefined;
  for (const record of records) {
    if (record.type !== type || record.channel !== channel) continue;
    if (latest === undefined || record.recordedAt.getTime() > latest.recordedAt.getTime()) {
      latest = record;
    }
  }
  return latest?.granted ?? false;
}

/** Channels on which a donation reminder may be sent. Empty array means: do not send. */
export function reminderChannels(
  records: readonly ConsentRecord[],
  available: readonly NotificationChannel[],
): NotificationChannel[] {
  if (!hasActiveConsent(records, "TERMS")) return [];
  return available.filter((channel) => hasActiveConsent(records, "DONATION_REMINDERS", channel));
}