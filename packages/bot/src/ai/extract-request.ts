/**
 * Multilingual request extraction → ExtractedRequest (shared contract).
 * Pipeline: detect language → LLM JSON → schema check → deterministic normalisation
 * → merge with rule-based parse (rules win on disagreement-free fields, AI fills gaps).
 * If no AI is available, the rule-based parse alone is returned (with lower confidence).
 */
import type { BloodComponent, BloodGroup, ExtractedField, ExtractedRequest, LanguageCode } from "@raktdoot/shared";
import { detectLanguage } from "./detect-language.ts";
import { normalizeBloodGroup, normalizeComponent, normalizeUnits, foldText } from "./normalize.ts";
import { parseNeededBy } from "./parse-time.ts";
import { extractionSystemPrompt } from "./prompts.ts";
import type { LlmClient } from "./llm-client.ts";

type FieldName = ExtractedRequest["missingFields"][number];
const FIELDS: FieldName[] = ["hospitalName", "bloodGroup", "component", "units", "neededBy"];

/** Below this confidence a field is treated as missing and the bot asks again. */
export const MIN_CONFIDENCE = 0.6;

const none = <T>(): ExtractedField<T> => ({ value: null, confidence: 0 });

function clamp01(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

/** Rule-based hospital guess: text around "hospital"/"अस्पताल"/"रुग्णालय". */
export function ruleHospital(text: string): string | null {
  const m =
    /([A-Z][\w.'&-]*(?:\s+[A-Z][\w.'&-]*){0,4}\s+(?:Hospital|Medical College|Clinic|Nursing Home|Institute))/u.exec(text) ??
    /((?:[\p{L}\p{M}]+\s+){1,3}(?:अस्पताल|रुग्णालय|हॉस्पिटल))/u.exec(text);
  return m ? m[1]!.trim() : null;
}

export function ruleBasedExtract(text: string, now: Date = new Date()): Omit<ExtractedRequest, "language" | "missingFields" | "originalText"> {
  const group = normalizeBloodGroup(text);
  const component = normalizeComponent(text);
  const unitMatch = /(\d{1,2}|[०-९]{1,2}|ek|do|teen|char|chaar|paanch|one|two|three|four|five|एक|दो|तीन|चार|पांच|दोन)\s*(units?|unt|bottles?|botal|yunit|यूनिट|युनिट|बोतल|बाटली|पिशव्या)/iu.exec(foldText(text));
  const units = unitMatch ? normalizeUnits(unitMatch[1]!) : null;
  const hospital = ruleHospital(text);
  const neededBy = parseNeededBy(text, now);
  return {
    hospitalName: hospital ? { value: hospital, confidence: 0.6 } : none(),
    bloodGroup: group ? { value: group, confidence: 0.9 } : none(),
    component: component ? { value: component, confidence: 0.85 } : none(),
    units: units ? { value: units, confidence: 0.85 } : none(),
    neededBy: neededBy ? { value: neededBy, confidence: 0.7 } : none(),
  };
}

interface RawAi {
  hospitalName?: unknown;
  bloodGroup?: unknown;
  component?: unknown;
  units?: unknown;
  neededBy?: unknown;
  confidence?: Record<string, unknown>;
}

/** Validate + normalise raw model JSON. Anything malformed becomes null. */
export function validateAiOutput(raw: unknown, now: Date): Omit<ExtractedRequest, "language" | "missingFields" | "originalText"> {
  const r = (raw && typeof raw === "object" ? raw : {}) as RawAi;
  const conf = (r.confidence && typeof r.confidence === "object" ? r.confidence : {}) as Record<string, unknown>;

  const hospital = typeof r.hospitalName === "string" && r.hospitalName.trim().length >= 2 ? r.hospitalName.trim().slice(0, 120) : null;
  const group: BloodGroup | null = typeof r.bloodGroup === "string" ? normalizeBloodGroup(r.bloodGroup) : null;
  const component: BloodComponent | null = typeof r.component === "string" ? normalizeComponent(r.component) : null;
  const units = typeof r.units === "number" || typeof r.units === "string" ? normalizeUnits(r.units) : null;

  let neededBy: string | null = null;
  if (typeof r.neededBy === "string") {
    const t = Date.parse(r.neededBy);
    // Accept only plausible times: not >1 day in the past, not >30 days ahead.
    if (Number.isFinite(t) && t > now.getTime() - 864e5 && t < now.getTime() + 30 * 864e5) neededBy = new Date(t).toISOString();
  }

  const field = <T>(value: T | null, key: string): ExtractedField<T> =>
    value === null ? none<T>() : { value, confidence: clamp01(conf[key]) || 0.7 };

  return {
    hospitalName: field(hospital, "hospitalName"),
    bloodGroup: field(group, "bloodGroup"),
    component: field(component, "component"),
    units: field(units, "units"),
    neededBy: field(neededBy, "neededBy"),
  };
}

function merge<T>(ai: ExtractedField<T>, rule: ExtractedField<T>): ExtractedField<T> {
  if (ai.value === null) return rule;
  if (rule.value === null) return ai;
  if (ai.value === rule.value) return { value: ai.value, confidence: Math.max(ai.confidence, rule.confidence, 0.9) };
  // Disagreement: keep AI value but force a confirmation question.
  return { value: ai.value, confidence: Math.min(ai.confidence, 0.5) };
}

export function computeMissing(fields: Pick<ExtractedRequest, FieldName>): FieldName[] {
  return FIELDS.filter((f) => fields[f].value === null || fields[f].confidence < MIN_CONFIDENCE);
}

export interface ExtractOptions {
  llm?: LlmClient | null;
  now?: Date;
  languageHint?: LanguageCode;
}

export async function extractRequest(text: string, opts: ExtractOptions = {}): Promise<ExtractedRequest & { usedAi: boolean }> {
  const now = opts.now ?? new Date();
  const input = text.slice(0, 2000);
  const language = opts.languageHint ?? detectLanguage(input).language;
  const rules = ruleBasedExtract(input, now);

  let fields = rules;
  let usedAi = false;
  if (opts.llm) {
    try {
      const raw = await opts.llm.completeJson([
        { role: "system", content: extractionSystemPrompt(now.toISOString()) },
        { role: "user", content: input },
      ]);
      const ai = validateAiOutput(raw, now);
      fields = {
        hospitalName: merge(ai.hospitalName, rules.hospitalName),
        bloodGroup: merge(ai.bloodGroup, rules.bloodGroup),
        component: merge(ai.component, rules.component),
        units: merge(ai.units, rules.units),
        neededBy: ai.neededBy.value !== null ? ai.neededBy : rules.neededBy,
      };
      usedAi = true;
    } catch {
      // Provider down / rate-limited: fall back to deterministic rules.
    }
  }
  return { language, ...fields, missingFields: computeMissing(fields), originalText: input, usedAi };
}

/** Merge a follow-up answer into an existing extraction (only fills/overrides fields it mentions). */
export function mergeFollowUp(prev: ExtractedRequest, next: ExtractedRequest): ExtractedRequest {
  const pick = <K extends FieldName>(k: K): ExtractedRequest[K] =>
    (next[k].value !== null && next[k].confidence >= prev[k].confidence * 0.9 ? next[k] : prev[k]) as ExtractedRequest[K];
  const fields = {
    hospitalName: pick("hospitalName"),
    bloodGroup: pick("bloodGroup"),
    component: pick("component"),
    units: pick("units"),
    neededBy: pick("neededBy"),
  };
  return { language: prev.language, ...fields, missingFields: computeMissing(fields), originalText: `${prev.originalText}\n${next.originalText}` };
}