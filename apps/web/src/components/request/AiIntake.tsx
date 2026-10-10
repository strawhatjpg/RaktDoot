"use client";
// "Describe it in your words": text or voice (Web Speech API) → M1's extraction → form prefill.
import { useEffect, useRef, useState } from "react";
import type { ExtractedRequest } from "@raktdoot/shared";
import { api, ApiFailure } from "../../lib/api.ts";
import { IconMic, IconWand } from "../icons.tsx";
import { useToast } from "../Toast.tsx";

const EXAMPLES = [
  "Papa ko kal subah tak 2 unit B+ve PRBC chahiye, Demo Hospital 1",
  "Need 3 units O- platelets urgently at Demo Hospital 1",
  "माझ्या आईसाठी उद्या 1 युनिट A+ रक्त हवे आहे",
];

type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export function AiIntake({ onExtracted }: { onExtracted: (x: ExtractedRequest & { usedAi: boolean }) => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const rec = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSpeechOk(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  function toggleMic() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = "hi-IN"; // understands Hindi, Hinglish and Indian English
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); toast("Voice input stopped. You can type instead.", { error: true }); };
    rec.current = r;
    setListening(true);
    r.start();
  }

  async function extract() {
    if (text.trim().length < 2) return;
    setBusy(true);
    try {
      const x = await api.extract(text.trim());
      onExtracted(x);
      toast(x.missingFields.length ? "Filled what we understood. Please check the rest." : "All details filled. Please review and confirm.");
    } catch (e) {
      toast(e instanceof ApiFailure ? e.message : "Could not read that. Please fill the form.", { error: true });
    } finally { setBusy(false); }
  }

  return (
    <section className="glass card stack" style={{ gap: 12, background: "linear-gradient(135deg, rgba(167,139,250,.12), rgba(225,29,72,.08))" }}>
      <div className="row between">
        <div className="row" style={{ gap: 8 }}><IconWand width={18} style={{ color: "var(--violet)" }} /><strong>Describe it in your words</strong></div>
        <span className="chip chip-violet">AI · हिंदी · English · मराठी</span>
      </div>
      <div style={{ position: "relative" }}>
        <textarea className="textarea" rows={3} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Papa ko kal subah tak 2 unit B+ve chahiye…" aria-label="Describe your blood requirement" style={{ paddingRight: 56 }} />
        {speechOk && (
          <button type="button" className="icon-btn" onClick={toggleMic} aria-label={listening ? "Stop voice input" : "Speak"} aria-pressed={listening}
            style={{ position: "absolute", right: 10, bottom: 12, background: listening ? "var(--red)" : undefined, borderColor: listening ? "var(--red-2)" : undefined }}>
            <IconMic width={18} />
          </button>
        )}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="chip" style={{ cursor: "pointer", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }} onClick={() => setText(ex)}>{ex.slice(0, 34)}…</button>
        ))}
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => void extract()} disabled={busy || text.trim().length < 2}>
        <IconWand width={18} /> {busy ? "Understanding…" : "Fill the form for me"}
      </button>
      <p className="tiny faint" style={{ margin: 0 }}>AI only reads your words to fill the form. You review everything before the request is created.</p>
    </section>
  );
}
