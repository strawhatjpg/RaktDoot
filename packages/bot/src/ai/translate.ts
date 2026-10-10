/**
 * AI translation for DYNAMIC text only (e.g. coordinator notes, centre instructions).
 * Fixed bot text comes from i18n catalogs. A glossary pins medical terms, blood groups,
 * request IDs and numbers are protected, and results are cached to save free-tier quota.
 */
import type { LanguageCode } from "@raktdoot/shared";
import type { LlmClient } from "./llm-client.ts";

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  hi: "Hindi in Devanagari script",
  "hi-Latn": "Hinglish (Hindi written in Latin script, as typed on WhatsApp)",
  mr: "Marathi in Devanagari script",
};

/** Terms that must keep a fixed rendering. */
export const GLOSSARY: Record<string, Partial<Record<LanguageCode, string>>> = {
  "blood centre": { hi: "ब्लड सेंटर", "hi-Latn": "blood centre", mr: "ब्लड सेंटर" },
  "platelets": { hi: "प्लेटलेट्स", "hi-Latn": "platelets", mr: "प्लेटलेट्स" },
  "packed red cells": { hi: "पैक्ड रेड सेल्स (PRBC)", "hi-Latn": "packed red cells (PRBC)", mr: "पॅक्ड रेड सेल्स (PRBC)" },
  "plasma": { hi: "प्लाज़्मा", "hi-Latn": "plasma", mr: "प्लाझ्मा" },
  "donor": { hi: "डोनर", "hi-Latn": "donor", mr: "रक्तदाता" },
  "unit": { hi: "यूनिट", "hi-Latn": "unit", mr: "युनिट" },
};

/** Tokens that must survive translation unchanged: blood groups, request IDs, phone numbers, URLs. */
const PROTECTED = /(https?:\/\/\S+|\b(?:AB|A|B|O)[+-](?!\w)|\bRD-[A-Z0-9]{4,}\b|\+?\d[\d\s-]{7,}\d)/g;

export function protectTokens(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(PROTECTED, (m) => `⟦${tokens.push(m) - 1}⟧`);
  return { masked, tokens };
}

export function restoreTokens(text: string, tokens: string[]): string {
  return text.replace(/⟦(\d+)⟧/g, (m, i: string) => tokens[Number(i)] ?? m);
}

export function glossaryFor(target: LanguageCode): string {
  return Object.entries(GLOSSARY)
    .map(([term, map]) => (map[target] ? `"${term}" → "${map[target]}"` : null))
    .filter(Boolean)
    .join("; ");
}

const cache = new Map<string, string>();

export async function translate(
  text: string,
  target: LanguageCode,
  llm: LlmClient | null,
  source: LanguageCode | "auto" = "auto",
): Promise<{ text: string; translated: boolean }> {
  if (!text.trim() || target === source) return { text, translated: false };
  const key = `${target}|${text}`;
  const hit = cache.get(key);
  if (hit) return { text: hit, translated: true };
  if (!llm) return { text, translated: false };

  const { masked, tokens } = protectTokens(text);
  try {
    const raw = await llm.completeJson([
      {
        role: "system",
        content:
          `Translate the user's text into ${LANGUAGE_NAMES[target]}. Keep it short, polite and plain. ` +
          `Keep every ⟦n⟧ placeholder exactly as is. Use this glossary: ${glossaryFor(target)}. ` +
          `Do not add medical advice or new information. Return JSON: {"translation": string}`,
      },
      { role: "user", content: masked },
    ]);
    const out = (raw as { translation?: unknown }).translation;
    if (typeof out !== "string" || !out.trim()) return { text, translated: false };
    // Every protected token must still be present; otherwise fall back to the original.
    const placeholders = masked.match(/⟦\d+⟧/g) ?? [];
    if (!placeholders.every((p) => out.includes(p))) return { text, translated: false };
    const result = restoreTokens(out.trim(), tokens);
    if (cache.size > 500) cache.clear();
    cache.set(key, result);
    return { text: result, translated: true };
  } catch {
    return { text, translated: false };
  }
}