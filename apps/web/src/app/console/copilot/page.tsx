"use client";
// Coordinator Copilot (Cline SDK, M3). Grounded answers via tools; can only create drafts.
import { useEffect, useRef, useState } from "react";
import { DraftCard } from "../../../components/console/DraftCard.tsx";
import { IconArrow, IconSpark } from "../../../components/icons.tsx";
import { Chip } from "../../../components/Ui.tsx";
import { api, forecastErrorMessage } from "../../../lib/api.ts";
import type { CopilotAnswer, CopilotDraft } from "../../../lib/types.ts";

type Turn = { id: number; q: string; a?: CopilotAnswer; error?: string };
const SUGGESTIONS = [
  "Which open requests are most at risk right now?",
  "Give me today's shortage briefing for Pune",
  "Draft a B+ platelet donation campaign for next week",
  "Kaunse blood group ki kami agle hafte ho sakti hai?",
];

export default function CopilotPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const end = useRef<HTMLDivElement | null>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [turns]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const id = ++seq.current;
    setTurns((t) => [...t, { id, q: text }]);
    setQ(""); setBusy(true);
    try {
      const a = await api.ask(text);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, a } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: forecastErrorMessage(e) } : x)));
    } finally { setBusy(false); }
  }

  const updateDraft = (d: CopilotDraft) => setTurns((t) => t.map((x) => (x.a ? { ...x, a: { ...x.a, drafts: x.a.drafts.map((y) => (y.id === d.id ? d : y)) } } : x)));

  return (
    <div className="stack fade-up" style={{ gap: 18, maxWidth: 880 }}>
      <div>
        <span className="eyebrow">Built on the Cline SDK</span>
        <h1 className="h2" style={{ marginTop: 6 }}>Coordinator Copilot</h1>
        <p className="muted small" style={{ margin: "6px 0 0" }}>Answers come from live tools: open requests, centres, forecasts and donor ranking. It never sends messages. It drafts them for your approval.</p>
      </div>

      {turns.length === 0 && (
        <div className="grid-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="glass card hover-lift row" style={{ gap: 12, textAlign: "left", cursor: "pointer" }} onClick={() => void ask(s)}>
              <IconSpark width={18} style={{ color: "var(--violet)", flex: "0 0 auto" }} /><span className="small">{s}</span>
            </button>
          ))}
        </div>
      )}

      {turns.map((t) => (
        <div key={t.id} className="stack" style={{ gap: 10 }}>
          <div className="bubble me" style={{ background: "linear-gradient(135deg, rgba(255,77,109,.35), rgba(225,29,72,.25))" }}>{t.q}</div>
          {t.error ? <div className="glass card small" style={{ borderColor: "rgba(255,77,109,.4)" }} role="alert">{t.error}</div> : !t.a ? (
            <div className="glass card row small muted" style={{ gap: 10 }}><span className="dot dot-live" style={{ color: "var(--violet)" }} /> Thinking with tools…</div>
          ) : (
            <div className="glass card stack" style={{ gap: 12 }}>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14.5 }}>{t.a.text}</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {t.a.toolsUsed.map((tool) => <Chip key={tool} tone="violet">🔧 {tool}</Chip>)}
                <Chip>{t.a.provider}</Chip>
              </div>
              {t.a.drafts.map((d) => <DraftCard key={d.id} draft={d} onChange={updateDraft} />)}
            </div>
          )}
        </div>
      ))}
      <div ref={end} />

      <form className="glass row" style={{ gap: 8, padding: 8, borderRadius: 999, position: "sticky", bottom: 16 }} onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        <input className="input" style={{ border: 0, background: "transparent", boxShadow: "none" }} placeholder="Ask in English, Hindi, Hinglish or Marathi…" value={q} maxLength={2000} onChange={(e) => setQ(e.target.value)} aria-label="Ask the Copilot" />
        <button className="btn btn-primary" style={{ height: 44 }} disabled={busy || !q.trim()} aria-label="Ask"><IconArrow width={18} /></button>
      </form>
    </div>
  );
}
