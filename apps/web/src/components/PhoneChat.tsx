"use client";
// WhatsApp-style phone mock-up. Renders text, reply buttons and location requests from M1's OutboundMessage.
import { useEffect, useRef, useState } from "react";
import type { OutboundMessage } from "@raktdoot/shared";
import { IconArrow, IconPin, IconWhatsApp } from "./icons.tsx";

export type ChatMsg = { id: number; me: boolean; text: string; buttons?: OutboundMessage["buttons"]; kind?: OutboundMessage["kind"] };
export type SendInput = { text?: string; buttonId?: string; location?: { lat: number; lng: number; label?: string } };

const BOT_BUBBLE = { background: "#1f2c34", borderColor: "transparent" };

/** `preset.n` changes on every click so the same suggestion can be re-applied. */
export function PhoneChat({ msgs, busy, onSend, preset }: { msgs: ChatMsg[]; busy: boolean; onSend: (input: SendInput, shown: string) => void; preset?: { text: string; n: number } }) {
  const [text, setText] = useState(preset?.text ?? "");
  const end = useRef<HTMLDivElement | null>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, busy]);
  useEffect(() => { if (preset?.text) setText(preset.text); }, [preset]);

  function submit() {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    onSend({ text: t }, t);
  }

  return (
    <div style={{ width: "100%", maxWidth: 390, margin: "0 auto", borderRadius: 44, padding: 10, background: "linear-gradient(160deg, #2a1218, #0d0507)", border: "1px solid var(--border-strong)", boxShadow: "0 40px 80px -20px rgba(0,0,0,.8)" }}>
      <div style={{ borderRadius: 36, overflow: "hidden", background: "#0b141a", display: "flex", flexDirection: "column", height: 640 }}>
        <div className="row" style={{ gap: 10, padding: "14px 16px", background: "#1f2c34" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--red-2), var(--red))" }}>🩸</div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>RaktDoot</div><div className="tiny" style={{ color: "#8696a0" }}>{busy ? "typing…" : "online"}</div></div>
          <IconWhatsApp width={22} style={{ color: "#25d366" }} />
        </div>
        <div className="chat" style={{ flex: 1, background: "#0b141a" }}>
          {msgs.length === 0 && <div className="tiny" style={{ alignSelf: "center", color: "#8696a0", background: "#1f2c34", padding: "6px 12px", borderRadius: 8 }}>Say hi to start the conversation</div>}
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.me ? "me" : "bot"}`} style={m.me ? undefined : BOT_BUBBLE}>
              {m.text}
              {!m.me && m.buttons && m.buttons.length > 0 && (
                <div className="bubble-btns">
                  {m.buttons.map((b) => (
                    <button key={b.id} className="chip" style={{ cursor: "pointer", color: "#53bdeb", background: "rgba(83,189,235,.08)" }} disabled={busy} onClick={() => onSend({ buttonId: b.id }, b.title)}>{b.title}</button>
                  ))}
                </div>
              )}
              {!m.me && m.kind === "location_request" && (
                <div className="bubble-btns">
                  <button className="chip" style={{ cursor: "pointer", color: "#53bdeb" }} disabled={busy}
                    onClick={() => onSend({ location: { lat: 18.5204, lng: 73.8567, label: "Shivajinagar, Pune" } }, "📍 Shivajinagar, Pune")}><IconPin width={13} /> Send location</button>
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble bot" style={BOT_BUBBLE}><span className="dot dot-live" /> <span className="dot dot-live" style={{ animationDelay: ".2s" }} /> <span className="dot dot-live" style={{ animationDelay: ".4s" }} /></div>}
          <div ref={end} />
        </div>
        <form className="row" style={{ gap: 8, padding: 10, background: "#1f2c34" }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input className="input" style={{ height: 44, borderRadius: 22, background: "#2a3942", border: 0 }} placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} aria-label="Message" />
          <button className="icon-btn" style={{ borderRadius: "50%", background: "#00a884", border: 0, width: 44, height: 44 }} aria-label="Send" disabled={busy || !text.trim()}><IconArrow width={18} /></button>
        </form>
      </div>
    </div>
  );
}
