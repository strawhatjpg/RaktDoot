"use client";
// Approval queue for Copilot drafts. Nothing reaches a donor without a coordinator's approval here.
import { useCallback, useEffect, useState } from "react";
import { DraftCard } from "../../../components/console/DraftCard.tsx";
import { IconRefresh } from "../../../components/icons.tsx";
import { Empty, ErrorCard, Skeleton } from "../../../components/Ui.tsx";
import { api, ApiFailure } from "../../../lib/api.ts";
import type { CopilotDraft } from "../../../lib/types.ts";

const TABS = [
  { v: "PENDING_APPROVAL", label: "Pending" },
  { v: "APPROVED", label: "Approved" },
  { v: "REJECTED", label: "Rejected" },
] as const;

export default function DraftsPage() {
  const [tab, setTab] = useState<CopilotDraft["status"]>("PENDING_APPROVAL");
  const [drafts, setDrafts] = useState<CopilotDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null); setDrafts(null);
    try { setDrafts(await api.drafts(tab)); }
    catch (e) { setError(e instanceof ApiFailure ? e.message : "Could not load drafts"); }
  }, [tab]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="stack fade-up" style={{ gap: 18, maxWidth: 820 }}>
      <div className="row between wrap" style={{ gap: 12 }}>
        <div><span className="eyebrow">Human in the loop</span><h1 className="h2" style={{ marginTop: 6 }}>Outreach approvals</h1></div>
        <button className="icon-btn" onClick={() => void load()} aria-label="Refresh"><IconRefresh width={18} /></button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        {TABS.map((t) => (
          <button key={t.v} className={`chip${tab === t.v ? " chip-red" : ""}`} style={{ cursor: "pointer", height: 34, padding: "0 14px" }} onClick={() => setTab(t.v)}>{t.label}</button>
        ))}
      </div>
      {error ? <ErrorCard message={error} onRetry={() => void load()} /> : drafts === null ? (
        <><Skeleton h={180} /><Skeleton h={180} /></>
      ) : drafts.length === 0 ? (
        <Empty icon="📭" title={tab === "PENDING_APPROVAL" ? "Nothing to approve" : "No drafts here"} text="Ask the Copilot to draft donor outreach for a verified request or an area campaign." />
      ) : drafts.map((d) => (
        <DraftCard key={d.id} draft={d} onChange={(nd) => setDrafts((list) => (list ?? []).map((x) => (x.id === nd.id ? nd : x)).filter((x) => x.status === tab))} />
      ))}
    </div>
  );
}
