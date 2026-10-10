"use client";
// WhatsApp simulator: drives M1's processInbound via /api/simulator. Demo fallback without a Meta number.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { Brand } from "../../components/Drop.tsx";
import { IconArrow } from "../../components/icons.tsx";
import { PhoneChat, type ChatMsg, type SendInput } from "../../components/PhoneChat.tsx";
import { useToast } from "../../components/Toast.tsx";
import { api, ApiFailure } from "../../lib/api.ts";

const PERSONAS = [
  { from: "+919800000001", label: "Family (Hinglish)" },
  { from: "+919800000002", label: "Donor" },
  { from: "+919800000003", label: "Marathi user" },
];
const QUICK = ["Hi", "Papa ko kal tak 2 unit B+ve chahiye Demo Hospital 1", "STATUS", "HELP", "LANGUAGE", "STOP"];

function SimulatorInner() {
  const toast = useToast();
  const params = useSearchParams();
  const [from, setFrom] = useState(PERSONAS[0]!.from);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState({ text: params.get("text") ?? "", n: 0 });
  const seq = useRef(0);

  async function send(input: SendInput, shown: string) {
    setMsgs((m) => [...m, { id: ++seq.current, me: true, text: shown }]);
    setBusy(true);
    try {
      const replies = await api.simulate(from, input);
      setMsgs((m) => [...m, ...replies.map((r) => ({ id: ++seq.current, me: false, text: r.text, buttons: r.buttons, kind: r.kind }))]);
    } catch (e) {
      toast(e instanceof ApiFailure ? e.message : "Bot unavailable", { error: true });
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <Link href="/"><Brand /></Link>
          <Link href="/login" className="btn btn-ghost btn-sm">Open app <IconArrow width={14} /></Link>
        </div>
      </div>
      <main className="container" style={{ padding: "28px 20px 60px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, alignItems: "start" }}>
        <div className="stack fade-up" style={{ gap: 16 }}>
          <span className="eyebrow">Live demo · same bot as WhatsApp</span>
          <h1 className="h2">Donors stay on WhatsApp.<br /><span className="grad-text">No app to install.</span></h1>
          <p className="lead">This page runs the same conversation engine as the WhatsApp Cloud API webhook: language detection, Hinglish extraction, consent buttons and location sharing.</p>
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">Chat as</span>
            <div className="row wrap" style={{ gap: 8 }}>
              {PERSONAS.map((p) => (
                <button key={p.from} className={`chip${from === p.from ? " chip-red" : ""}`} style={{ cursor: "pointer", height: 34 }}
                  onClick={() => { setFrom(p.from); setMsgs([]); }}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">Try saying</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {QUICK.map((q) => <button key={q} className="chip" style={{ cursor: "pointer" }} onClick={() => setPreset((p) => ({ text: q, n: p.n + 1 }))}>{q.length > 30 ? `${q.slice(0, 30)}…` : q}</button>)}
            </div>
          </div>
          <p className="tiny faint">Uses fictional phone numbers. Messages are processed in memory and never sent anywhere.</p>
        </div>
        <PhoneChat msgs={msgs} busy={busy} onSend={(i, s) => void send(i, s)} preset={preset} />
      </main>
    </>
  );
}

export default function SimulatorPage() {
  return <Suspense fallback={null}><SimulatorInner /></Suspense>;
}
