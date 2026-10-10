import type { LanguageCode } from "@raktdoot/shared";
import { CATALOGS, MESSAGE_KEYS, type Catalog, type MessageKey } from "./messages.ts";
import { mr } from "./mr.ts";

const ALL: Record<LanguageCode, Catalog> = { ...CATALOGS, mr };

/** Look up a reviewed string in the user's language, falling back to English. */
export function t(lang: LanguageCode, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const template = ALL[lang]?.[key] ?? ALL.en[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

/** Used by tests: every language must define every key. */
export function missingKeys(): Array<{ lang: LanguageCode; key: MessageKey }> {
  const out: Array<{ lang: LanguageCode; key: MessageKey }> = [];
  for (const lang of Object.keys(ALL) as LanguageCode[])
    for (const key of MESSAGE_KEYS) if (!ALL[lang][key]) out.push({ lang, key });
  return out;
}

export const BUTTON_KEYS = MESSAGE_KEYS.filter((k) => k.startsWith("btn_"));
export { ALL as CATALOG_BY_LANGUAGE };