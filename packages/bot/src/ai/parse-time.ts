/**
 * Rule-based "needed by" parser for common phrases (works without AI).
 * All times are Asia/Kolkata (UTC+5:30, no DST). Returns ISO UTC or null.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Whole-word match that also works for Devanagari (JS \b does not). "Kalyani" ≠ "kal", "Abhishek" ≠ "abhi". */
const word = (alts: string) => new RegExp(`(?<![\\p{L}\\p{M}])(?:${alts})(?![\\p{L}\\p{M}])`, "u");

const TODAY = word("today|aaj|आज");
const TOMORROW = word("tomorrow|kal|कल|उद्या|udya");
const MORNING = word("morning|subah|सुबह|सकाळी");
const EVENING = word("evening|shaam|sham|शाम|संध्याकाळी|संध्याकाळ|संध्याकाळपर्यंत");
const NIGHT = word("night|raat|रात|रात्री");
const AFTERNOON = word("afternoon|dopahar|दोपहर|दुपारी");
// Note: "urgent"/"asap" are deliberately NOT turned into a deadline — urgency is a clinical
// judgement. The bot asks "by when?" and the family states a time.

/** Returns { hour, minute } in IST if a clock time is stated. */
function clockTime(text: string): { h: number; m: number } | null {
  // Suffix is required so "2 unit" is never read as 2 o'clock.
  const m = /(?<![\d:.])(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|baje|बजे|वाजता)(?![\p{L}\p{M}])/u.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  // "6 baje shaam" → 18:00
  if (m[3] !== "am" && m[3] !== "pm" && h < 12 && (EVENING.test(text) || NIGHT.test(text) || (AFTERNOON.test(text) && h < 7))) h += 12;
  return { h, m: min };
}

export function parseNeededBy(input: string, now: Date = new Date()): string | null {
  const text = input.toLowerCase();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const dayOffset = TOMORROW.test(text) && !TODAY.test(text) ? 1 : TODAY.test(text) ? 0 : null;
  let clock = clockTime(text);
  if (!clock) {
    if (MORNING.test(text)) clock = { h: 10, m: 0 };
    else if (AFTERNOON.test(text)) clock = { h: 14, m: 0 };
    else if (EVENING.test(text)) clock = { h: 18, m: 0 };
    else if (NIGHT.test(text)) clock = { h: 21, m: 0 };
  }
  if (dayOffset === null && !clock) return null;

  const c = clock ?? { h: 20, m: 0 };
  const target = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + (dayOffset ?? 0), c.h, c.m) - IST_OFFSET_MS;
  // A bare clock time already passed today means tomorrow.
  const fixed = dayOffset === null && target < now.getTime() ? target + 864e5 : target;
  return new Date(fixed).toISOString();
}

/** Human-readable IST time for confirmation cards, e.g. "10 Oct, 6:00 pm". */
export function formatIst(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}