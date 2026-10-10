"use client";
// Step 1: terms + one consent per purpose (M2 POST /api/consent). CONTACT_SHARING is per request, never here.
import { useState } from "react";
import type { ConsentUpdateItem } from "@raktdoot/shared";
import { api, ApiFailure } from "../../lib/api.ts";
import { useToast } from "../Toast.tsx";
import { Toggle } from "../Ui.tsx";

export const CONSENT_ITEMS = [
  { key: "alertsWa", type: "URGENT_ALERTS", channel: "WHATSAPP", title: "Urgent alerts on WhatsApp", text: "Only for verified requests near you. Reply Accept, Decline or Pause." },
  { key: "remindWa", type: "DONATION_REMINDERS", channel: "WHATSAPP", title: "Donation reminders", text: "A gentle note when you may be eligible again (90/120 days)." },
  { key: "location", type: "LOCATION_STORAGE", channel: null, title: "Store my approximate location", text: "Rounded to ~1 km so we alert only nearby donors. Delete anytime." },
] as const;
type Key = (typeof CONSENT_ITEMS)[number]["key"];

export function ConsentStep({ termsVersion, onDone }: { termsVersion: string; onDone: () => void }) {
  const toast = useToast();
  const [terms, setTerms] = useState(false);
  const [c, setC] = useState<Record<Key, boolean>>({ alertsWa: true, remindWa: true, location: true });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const updates: ConsentUpdateItem[] = [
        { type: "TERMS", channel: null, granted: true },
        ...CONSENT_ITEMS.map((i) => ({ type: i.type, channel: i.channel, granted: c[i.key] })),
      ];
      await api.updateConsent(termsVersion, updates);
      onDone();
    } catch (e) { toast(e instanceof ApiFailure ? e.message : "Could not save consent", { error: true }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div><h1 className="h2" style={{ fontSize: 28 }}>Become a life-saver</h1><p className="muted" style={{ margin: "6px 0 0" }}>You choose exactly what we may do. Change it anytime.</p></div>
      <label className="glass card row" style={{ gap: 14, cursor: "pointer", borderColor: terms ? "rgba(255,77,109,.4)" : undefined }}>
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ width: 22, height: 22, accentColor: "#e11d48", flex: "0 0 auto" }} />
        <span className="small"><strong>I accept the terms & privacy notice</strong> <span className="muted">(version {termsVersion}). Donations happen only at licensed blood centres; screening there is final.</span></span>
      </label>
      {CONSENT_ITEMS.map((item) => (
        <div key={item.key} className="glass card row between" style={{ gap: 14, opacity: terms ? 1 : 0.5 }}>
          <div><strong className="small">{item.title}</strong><div className="tiny muted" style={{ marginTop: 3 }}>{item.text}</div></div>
          <Toggle checked={c[item.key]} disabled={!terms} label={item.title} onChange={(v) => setC((s) => ({ ...s, [item.key]: v }))} />
        </div>
      ))}
      <button className="btn btn-primary btn-block" disabled={!terms || busy} onClick={() => void save()}>{busy ? "Saving…" : "Continue"}</button>
    </>
  );
}
