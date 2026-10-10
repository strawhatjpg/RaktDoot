/**
 * Multilingual extraction eval. Scores per-field accuracy and language detection.
 *   node evals/multilingual/run-evals.ts            → rules only (offline baseline)
 *   node --env-file=.env evals/multilingual/run-evals.ts --ai   → Gemini/Groq + rules
 * Writes evals/multilingual/results.md (quote it in the README / PPT).
 * A null expected value means "must NOT be guessed": predicting anything is an error.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractRequest } from "../../packages/bot/src/ai/extract-request.ts";
import { detectLanguage } from "../../packages/bot/src/ai/detect-language.ts";
import { createLlmClient, providersFromEnv } from "../../packages/bot/src/ai/llm-client.ts";

interface Case {
  id: string;
  lang: string;
  input: string;
  expected: { bloodGroup: string | null; component: string | null; units: number | null; hospital: string | null };
}

const here = dirname(fileURLToPath(import.meta.url));
const cases: Case[] = readFileSync(join(here, "cases.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const useAi = process.argv.includes("--ai");
const providers = providersFromEnv();
if (useAi && providers.length === 0) {
  console.error("--ai needs GEMINI_API_KEY or GROQ_API_KEY (run with node --env-file=.env)");
  process.exit(1);
}
const llm = useAi ? createLlmClient(providers) : null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FIELDS = ["bloodGroup", "component", "units", "hospital", "language"] as const;
type Field = (typeof FIELDS)[number];
const score: Record<Field, { ok: number; n: number }> = Object.fromEntries(FIELDS.map((f) => [f, { ok: 0, n: 0 }])) as never;
const byLang = new Map<string, { ok: number; n: number }>();
const failures: string[] = [];
let unsafeGuesses = 0;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

for (const c of cases) {
  const r = await extractRequest(c.input, { llm, now: new Date("2026-10-10T06:30:00Z") });
  const detected = detectLanguage(c.input).language;
  const got = {
    bloodGroup: r.bloodGroup.confidence >= 0.6 ? r.bloodGroup.value : null,
    component: r.component.confidence >= 0.6 ? r.component.value : null,
    units: r.units.confidence >= 0.6 ? r.units.value : null,
    hospital: r.hospitalName.value,
  };
  const check = (f: Field, ok: boolean, detail: string) => {
    score[f].n++;
    const l = byLang.get(c.lang) ?? { ok: 0, n: 0 };
    l.n++;
    if (ok) { score[f].ok++; l.ok++; } else failures.push(`| ${c.id} | ${f} | ${detail} |`);
    byLang.set(c.lang, l);
  };
  for (const f of ["bloodGroup", "component", "units"] as const) {
    const ok = got[f] === c.expected[f];
    if (!ok && c.expected[f] === null && got[f] !== null && f === "bloodGroup") unsafeGuesses++;
    check(f, ok, `expected ${c.expected[f]} got ${got[f]}`);
  }
  const h = c.expected.hospital;
  check("hospital", h === null ? true : got.hospital !== null && norm(got.hospital).includes(norm(h)), `expected ~${h} got ${got.hospital}`);
  check("language", detected === c.lang, `expected ${c.lang} got ${detected}`);
  if (llm) await sleep(2200); // stay under free-tier RPM
}

const pct = (s: { ok: number; n: number }) => (s.n ? ((100 * s.ok) / s.n).toFixed(1) : "-");
const total = Object.values(score).reduce((a, s) => ({ ok: a.ok + s.ok, n: a.n + s.n }), { ok: 0, n: 0 });
const mode = useAi ? `AI (${providers.map((p) => `${p.name}:${p.model}`).join(" → ")}) + rules` : "rules only (no AI)";
const md = [
  `# Multilingual extraction results`,
  ``,
  `Mode: **${mode}** · Cases: ${cases.length} · Run: ${new Date().toISOString()}`,
  ``,
  `| Field | Accuracy |`, `|---|---|`,
  ...FIELDS.map((f) => `| ${f} | ${pct(score[f])}% (${score[f].ok}/${score[f].n}) |`),
  `| **Overall** | **${pct(total)}%** |`,
  ``,
  `Unsafe blood-group guesses (value given when the message did not state one): **${unsafeGuesses}**`,
  ``,
  `| Language | Field accuracy |`, `|---|---|`,
  ...[...byLang].map(([l, s]) => `| ${l} | ${pct(s)}% |`),
  ``,
  `## Failures`, ``, `| Case | Field | Detail |`, `|---|---|---|`, ...failures,
  ``,
].join("\n");
writeFileSync(join(here, useAi ? "results.md" : "results-rules.md"), md, "utf8");
console.log(md.split("## Failures")[0]);