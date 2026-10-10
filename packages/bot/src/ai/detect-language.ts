/**
 * Fast, offline language detection. Runs before any AI call so replies use the
 * right language even when the AI provider is rate-limited.
 * - Devanagari: Marathi vs Hindi via marker words.
 * - Latin: Hinglish (hi-Latn) vs English via common romanised Hindi words.
 */
import type { LanguageCode } from "@raktdoot/shared";

const DEVANAGARI = /[\u0900-\u097F]/gu;
const LATIN = /[a-z]/giu;

const MARATHI_MARKERS = [
  "आहे", "आहेत", "पाहिजे", "हवे", "हवं", "रुग्णालयात", "माझ्या", "माझे", "आम्हाला",
  "लवकर", "कृपया", "दाखल", "बाबा", "आई", "ची", "चे", "च्या", "नाही", "होय", "मध्ये",
];
const HINDI_MARKERS = [
  "है", "हैं", "चाहिए", "अस्पताल", "मेरे", "मुझे", "हमें", "जल्दी", "भर्ती", "में",
  "का", "की", "के", "नहीं", "हाँ", "पापा", "माँ", "कृपया",
];
const HINGLISH_MARKERS = [
  "hai", "hain", "chahiye", "chaiye", "chahie", "mein", "ke", "ki", "ka", "ko", "hum",
  "mujhe", "humein", "mere", "meri", "papa", "mummy", "bhai", "jaldi", "bhar", "bharti",
  "nahi", "nahin", "haan", "kal", "aaj", "abhi", "kya", "kahan",
  "zaroorat", "jarurat", "bohot", "bahut", "bhaiya", "didi", "aur", "chalega", "koi", "bhi", "ya",
  "pahije", "aahe", "lavkar", "hava", "havay",
];
const MARATHI_LATIN = ["pahije", "aahe", "aahet", "lavkar", "havay", "hava", "majhya", "amhala", "kara"];

function countWords(text: string, words: readonly string[]): number {
  const tokens = text.toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  let score = 0;
  for (const t of tokens) if (words.includes(t)) score++;
  return score;
}

export interface LanguageGuess {
  language: LanguageCode;
  confidence: number; // 0..1
}

export function detectLanguage(text: string, fallback: LanguageCode = "en"): LanguageGuess {
  const deva = text.match(DEVANAGARI)?.length ?? 0;
  const latin = text.match(LATIN)?.length ?? 0;
  if (deva === 0 && latin === 0) return { language: fallback, confidence: 0.2 };

  if (deva >= latin) {
    const mr = countWords(text, MARATHI_MARKERS);
    const hi = countWords(text, HINDI_MARKERS);
    if (mr > hi) return { language: "mr", confidence: Math.min(0.95, 0.6 + 0.1 * (mr - hi)) };
    return { language: "hi", confidence: hi > mr ? Math.min(0.95, 0.6 + 0.1 * (hi - mr)) : 0.55 };
  }

  // Romanised Marathi is rare in our scope; we treat it as Hinglish-family but prefer mr when clear.
  const mrLatin = countWords(text, MARATHI_LATIN);
  const hiLatin = countWords(text, HINGLISH_MARKERS) - mrLatin;
  if (mrLatin >= 2 && mrLatin > hiLatin) return { language: "mr", confidence: 0.6 };
  if (hiLatin >= 1) return { language: "hi-Latn", confidence: Math.min(0.95, 0.55 + 0.1 * hiLatin) };
  return { language: "en", confidence: 0.7 };
}