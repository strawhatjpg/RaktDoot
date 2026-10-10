"use client";
import Link from "next/link";
import type { Briefing } from "../../lib/types.ts";
import { COMPONENT_LABEL, shortId } from "../../lib/format.ts";
import { IconArrow, IconChat, IconInbox } from "../icons.tsx";
import { Chip, Skeleton } from "../Ui.tsx";
import { RiskBar } from "./Charts.tsx";

export function Kpi({ label, value, tone, href }: { label: string; value: number | undefined; tone: string; href?: string }) {
  const body = (
    <div className="glass card hover-lift stack" style={{ gap: 8 }}>
      <span className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>{label}</span>
      <span className="stat-num" style={{ color: tone }}>{value ?? "—"}</span>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function RiskList({ briefing, loading }: { briefing: Briefing | null; loading: boolean }) {
  return (
    <section className="glass card-lg stack" style={{ gap: 14 }}>
      <div className="row between"><h2 className="h3">Highest shortage risk</h2><span className="tiny faint">next 2 weeks</span></div>
      {loading ? <><Skeleton h={54} /><Skeleton h={54} /><Skeleton h={54} /></> : !briefing ? (
        <p className="muted small">Briefing unavailable.</p>
      ) : briefing.highRisk.length === 0 ? (
        <p className="muted small">No blood group or component is above the high-risk threshold. 🎉</p>
      ) : briefing.highRisk.map((p) => (
        <div key={`${p.weekStart}-${p.bloodGroup}-${p.component}`} className="stack" style={{ gap: 6 }}>
          <div className="row between small wrap" style={{ gap: 6 }}>
            <span><strong style={{ fontSize: 16 }}>{p.bloodGroup}</strong> <span className="muted">{COMPONENT_LABEL[p.component]} · wk {p.weekStart.slice(5)}</span></span>
            <span className="tiny muted">need {Math.round(p.p10)}–{Math.round(p.p90)} · supply ~{Math.round(p.expectedSupply)}</span>
          </div>
          <RiskBar value={p.shortageRisk} />
          {p.drivers[0] && <span className="tiny faint">{p.drivers[0]}</span>}
        </div>
      ))}
    </section>
  );
}

export function SidePanel({ briefing }: { briefing: Briefing | null }) {
  const improvement = briefing && briefing.backtest.baselineMae > 0 ? Math.round((1 - briefing.backtest.modelMae / briefing.backtest.baselineMae) * 100) : null;
  return (
    <section className="stack" style={{ gap: 16 }}>
      <div className="glass card-lg stack" style={{ gap: 8, background: "linear-gradient(135deg, rgba(52,211,153,.1), rgba(45,212,191,.05))" }}>
        <span className="eyebrow" style={{ color: "var(--green)" }}>Model vs baseline</span>
        <div className="stat-num" style={{ color: "var(--green)" }}>{improvement !== null ? `${improvement}%` : "—"}</div>
        <span className="small muted">{briefing ? `lower error (MAE ${briefing.backtest.modelMae} vs ${briefing.backtest.baselineMae}) over ${briefing.backtest.weeksTested} backtest weeks` : "waiting for the forecast service"}</span>
        <Link href="/console/forecast" className="small" style={{ color: "var(--teal)", marginTop: 4 }}>Open forecast →</Link>
      </div>
      {briefing && briefing.awaitingVerification.length > 0 && (
        <div className="glass card stack" style={{ gap: 8 }}>
          <strong className="small">Awaiting verification</strong>
          <div className="row wrap" style={{ gap: 6 }}>{briefing.awaitingVerification.slice(0, 8).map((id) => <Chip key={id} tone="amber">{shortId(id)}</Chip>)}</div>
        </div>
      )}
      <Link href="/console/copilot" className="glass card hover-lift row" style={{ gap: 14 }}>
        <IconChat width={22} style={{ color: "var(--violet)" }} />
        <div style={{ flex: 1 }}><strong className="small">Ask the Copilot</strong><div className="tiny muted">&quot;Which requests are at risk today?&quot;</div></div>
        <IconArrow width={16} />
      </Link>
      <Link href="/console/drafts" className="glass card hover-lift row" style={{ gap: 14 }}>
        <IconInbox width={22} style={{ color: "var(--gold)" }} />
        <div style={{ flex: 1 }}><strong className="small">Review outreach drafts</strong><div className="tiny muted">Approve, edit or reject before anything is sent</div></div>
        <IconArrow width={16} />
      </Link>
    </section>
  );
}
