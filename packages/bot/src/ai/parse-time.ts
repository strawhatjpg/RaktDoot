/**
 * Rule-based "needed by" parser for common phrases (works without AI).
 * All times are Asia/Kolkata (UTC+5:30, no DST). Returns ISO UTC or null.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;

const TODAY = /(today|aaj|आज)/u;
const TOMORROW = /(tomorrow|kal subah|kal|कल|उद्या|udya)/u;
const NOW = /(\basap\b|urgent|turant|abhi|अभी|तुरंत|लगेच|immediately|right now)/u;
const MORNING = /(morning|subah|सुबह|सकाळी)/u;
const EVENING = /(evening|shaam|sham|शाम|संध्याकाळी|संध्याकाळ)/u;
const NIGHT = /(night|raat|रात|रात्री)/u;
const AFTERNOON = /(afternoon|dopahar|दोपहर|दुपारी)/u;

/** Returns { hour, minute } in IST if a clock time is stated. */
function clockTime(text: string): { h: number; m: number } | null {
  const m = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|baje|बजे|वाजता)?\b/u.exec(text) ?? /(\d{1,2})(?:[:.](\d{2}))?\s*(बजे|वाजता)/u.exec(text);
  if (!m || !m[3]) return null;
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
  if (NOW.test(text)) return new Date(now.getTime() + 2 * 3600_000).toISOString();

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