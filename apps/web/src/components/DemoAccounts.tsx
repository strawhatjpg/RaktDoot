"use client";
// One-tap seeded demo accounts. Hidden unless the server reports DEMO_MODE=true.
import { useEffect, useState } from "react";
import { api, ApiFailure } from "../lib/api.ts";
import type { DemoAccount } from "../lib/types.ts";
import { useToast } from "./Toast.tsx";

export function DemoAccounts({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { api.demoAccounts().then((r) => setAccounts(r.accounts)).catch(() => setAccounts([])); }, []);

  async function signIn(id: string) {
    setBusy(id);
    try {
      await api.demoLogin(id);
      await onSignedIn();
    } catch (e) {
      toast(e instanceof ApiFailure ? e.message : "Demo sign-in failed", { error: true });
    } finally { setBusy(null); }
  }

  if (accounts.length === 0) return null;
  return (
    <section className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10 }}>
        <hr className="divider" style={{ flex: 1 }} /><span className="tiny faint">OR TRY A DEMO ACCOUNT</span><hr className="divider" style={{ flex: 1 }} />
      </div>
      <div className="grid-2">
        {accounts.map((a) => (
          <button key={a.id} className="glass card hover-lift" style={{ textAlign: "left", cursor: "pointer", padding: 16 }} onClick={() => void signIn(a.id)} disabled={busy !== null}>
            <strong style={{ display: "block" }}>{busy === a.id ? "Signing in…" : a.label}</strong>
            <span className="tiny muted">{a.description}</span>
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ margin: 0, textAlign: "center" }}>Demo accounts use fictional seeded data and work only in local demo mode.</p>
    </section>
  );
}
