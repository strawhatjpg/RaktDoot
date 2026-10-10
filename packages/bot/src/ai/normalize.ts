/**
 * Deterministic normalisation of AI / user text. No AI here: these rules are
 * the safety net that turns "B+ve", "बी पॉजिटिव", "O negative" into canonical values.
 */
import {
  BLOOD_GROUPS,
  BLOOD_COMPONENTS,
  type BloodComponent,
  type BloodGroup,
} from "@raktdoot/shared";

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Convert Devanagari digits to ASCII and lowercase/trim the text. */
export function foldText(input: string): string {
  let out = "";
  for (const ch of input) {
    const d = DEVANAGARI_DIGITS.indexOf(ch);
    out += d >= 0 ? String(d) : ch;
  }
  return out.toLowerCase().replace(/\s+/g, " ").trim();
}

// Letter must sit directly next to its Rh sign, e.g. "b positive", "o-ve", "बी पॉजिटिव".
// Custom boundaries because JS \b does not understand Devanagari.
const LETTER = "(ab|a|b|o|0|एबी|ए बी|ए|बी|ओ)";
const POS_WORDS = "\\+\\s*ve|\\+|positive|positve|posetive|pos|ve\\s*\\+|पॉजिटिव्ह|पॉजिटिव|पॉज़िटिव|पोजिटिव|पॉझिटिव्ह|पॉझिटिव";
const NEG_WORDS = "-\\s*ve|-|negative|negetive|neg|ve\\s*-|नेगेटिव्ह|नेगेटिव|निगेटिव|नेगेटीव";
const GROUP_RE = new RegExp(
  // Sign must not be followed by a letter or digit: "Wing A-2" / "B-12" are addresses, not blood groups.
  `(?<![\\p{L}\\p{M}\\d])${LETTER}\\s*(${POS_WORDS}|${NEG_WORDS})(?![\\p{L}\\p{M}\\d])`,
  "gu",
);
const LETTER_MAP: Record<string, "A" | "B" | "AB" | "O"> = {
  a: "A", b: "B", ab: "AB", o: "O", "0": "O",
  "ए": "A", "बी": "B", "एबी": "AB", "ए बी": "AB", "ओ": "O",
};

/**
 * Parse a blood group from free text. Returns null unless the letter AND the
 * Rh sign are both present — we never guess the Rh factor.
 */
export function normalizeBloodGroup(input: string | null | undefined): BloodGroup | null {
  if (!input) return null;
  const text = foldText(input);
  if ((BLOOD_GROUPS as readonly string[]).includes(text.toUpperCase())) return text.toUpperCase() as BloodGroup;

  const found = new Set<BloodGroup>();
  for (const m of text.matchAll(GROUP_RE)) {
    const letter = LETTER_MAP[m[1]!];
    if (!letter) continue;
    const sign = new RegExp(`^(${POS_WORDS})$`, "u").test(m[2]!) ? "+" : "-";
    found.add(`${letter}${sign}` as BloodGroup);
  }
  // Two different groups in one message is ambiguous: ask instead of guessing.
  return found.size === 1 ? [...found][0]! : null;
}

const COMPONENT_RULES: Array<[RegExp, BloodComponent]> = [
  [/(platelet|platlet|plt|sdp|rdp|apheresis|प्लेटलेट|प्लेटलेट्स)/u, "PLATELETS"],
  [/(plasma|ffp|प्लाज्मा|प्लाझ्मा)/u, "PLASMA"],
  [/(prbc|packed|red cell|rbc|pcv|पीआरबीसी)/u, "PACKED_RED_CELLS"],
  [/(whole blood|whole|पूर्ण रक्त|संपूर्ण रक्त)/u, "WHOLE_BLOOD"],
];

/** Map component wording to a canonical component, or null if not stated. */
export function normalizeComponent(input: string | null | undefined): BloodComponent | null {
  if (!input) return null;
  const upper = input.trim().toUpperCase();
  if ((BLOOD_COMPONENTS as readonly string[]).includes(upper)) return upper as BloodComponent;
  const text = foldText(input);
  for (const [pattern, component] of COMPONENT_RULES) if (pattern.test(text)) return component;
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "दोन": 2, "छह": 6,
};

/** Units are a positive integer 1..20; anything else is rejected rather than guessed. */
export function normalizeUnits(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let n: number | undefined;
  if (typeof input === "number") n = input;
  else {
    const text = foldText(input);
    const digits = /\b(\d{1,2})\b/.exec(text);
    if (digits) n = Number(digits[1]);
    else for (const word of text.split(/[\s,.]+/)) if (word in NUMBER_WORDS) { n = NUMBER_WORDS[word]; break; }
  }
  return n !== undefined && Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
}