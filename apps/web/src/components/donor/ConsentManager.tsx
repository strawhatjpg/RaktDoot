"use client";
// Live consent toggles for registered donors. Each change is an appended record (latest wins).
import { useState } from "react";
import type { ConsentStateDTO, ConsentType, NotificationChannel } from "@raktdoot/shared";
import { api, ApiFailure } from "../../lib/api.ts";
import { useToast } from "../Toast.tsx";
import { Toggle } from "../Ui.tsx";
import { CONSENT_ITEMS } from "./ConsentStep.tsx";

export function isGranted(state: ConsentStateDTO | null, type: ConsentType, channel: NotificationChannel | null): boolean {
  return !!state?.consents.find((c) => c.type === type && c.channel === channel)?.granted;
}

export function ConsentManager({ state, onChange }: { state: ConsentStateDTO; onChange: (s: ConsentStateDTO) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function set(type: (typeof CONSENT_ITEMS)[number]["type"], channel: NotificationChannel | null, granted: boolean) {
    setBusy(`${type}:${channel}`);
    try {
      onChange(await api.updateConsent(state.currentTermsVersion, [{ type, channel, granted }]));
      toast(granted ? "Permission granted" : "Permission withdrawn");
    } catch (e) { toast(e instanceof ApiFailure ? e.message : "Could not update", { error: true }); }
    finally { setBusy(null); }
  }

  return (
    <section className="glass card stack" style={{ gap: 4 }}>
      <strong style={{ marginBottom: 6 }}>Permissions</strong>
      {CONSENT_ITEMS.map((item, i) => (
        <div key={item.key}>
          {i > 0 && <hr className="divider" />}
          <div className="row between" style={{ gap: 14, padding: "8px 0" }}>
            <div><div className="small" style={{ fontWeight: 650 }}>{item.title}</div><div className="tiny muted">{item.text}</div></div>
            <Toggle checked={isGranted(state, item.type, item.channel)} disabled={busy !== null} label={item.title}
              onChange={(v) => void set(item.type, item.channel, v)} />
          </div>
        </div>
      ))}
      <p className="tiny faint" style={{ margin: "6px 0 0" }}>Withdrawing location storage deletes your stored area immediately. On WhatsApp, reply STOP anytime.</p>
    </section>
  );
}
