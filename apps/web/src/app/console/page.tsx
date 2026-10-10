"use client";
// Overview: deterministic shortage briefing (M3, no LLM) + backtest headline + quick actions.
import { useCallback, useEffect, useState } from "react";
import { Kpi, RiskList, SidePanel } from "../../components/console/Briefing.tsx";
import { useDistrict } from "../../components/console/useDistrict.ts";
import { IconRefresh } from "../../components/icons.tsx";
import { Chip, ErrorCard } from "../../components/Ui.tsx";
import { api, forecastErrorMessage } from "../../lib/api.ts";
import { timeAgo } from "../../lib/format.ts";
import type { Briefing } from "../../lib/types.ts";

export default function ConsoleOverview() {
  const district = useDistrict();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null); setLoading(true);
    api.drafts("PENDING_APPROVAL").then((d) => setPending(d.length)).catch(() => setPending(undefined));
    try { setBriefing((await api.briefing(district)).briefing); }
    catch (e) { setError(forecastErrorMessage(e)); }
    finally { setLoading(false); }
  }, [district]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="stack fade-up" style={{ gap: 20 }}>
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <span className="eyebrow">Daily shortage briefing</span>
          <h1 className="h2" style={{ marginTop: 6 }}>{district}</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {briefing?.isSynthetic && <Chip tone="amber">synthetic data</Chip>}
          {briefing && <span className="tiny faint">generated {timeAgo(briefing.generatedAt)}</span>}
          <button className="icon-btn" onClick={() => void load()} aria-label="Refresh"><IconRefresh width={18} /></button>
        </div>
      </div>

      {error && <ErrorCard message={error} onRetry={() => void load()} />}

      <div className="grid-4">
        <Kpi label="Open requests" value={briefing?.openRequests} tone="var(--red-2)" />
        <Kpi label="Awaiting verification" value={briefing?.awaitingVerification.length} tone="var(--amber)" />
        <Kpi label="Outreach active" value={briefing?.outreachActive.length} tone="var(--teal)" />
        <Kpi label="Drafts to approve" value={pending} tone="var(--violet)" href="/console/drafts" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <RiskList briefing={briefing} loading={loading} />
        <SidePanel briefing={briefing} />
      </div>
    </div>
  );
}
