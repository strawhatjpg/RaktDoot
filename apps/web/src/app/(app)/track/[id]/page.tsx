"use client";
// Live case tracking: status hero, journey timeline (M2 events), nearby centres. Refreshes every 15 s.
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { BloodRequestDetailDTO } from "@raktdoot/shared";
import { CentreList } from "../../../../components/CentreList.tsx";
import { IconRefresh, IconShield, IconWhatsApp } from "../../../../components/icons.tsx";
import { Journey } from "../../../../components/Journey.tsx";
import { useRequireSession } from "../../../../components/Session.tsx";
import { useToast } from "../../../../components/Toast.tsx";
import { Chip, ErrorCard, PageHeader, SimulatedNote, Skeleton } from "../../../../components/Ui.tsx";
import { api, ApiFailure, isStaff } from "../../../../lib/api.ts";
import { COMPONENT_LABEL, STATUS_LABEL, VERIFICATION_LABEL, formatWhen, shortId, timeAgo } from "../../../../lib/format.ts";

function TrackInner() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const { me } = useRequireSession();
  const toast = useToast();
  const [data, setData] = useState<BloodRequestDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => new Date().toISOString());

  const load = useCallback(async () => {
    try { setData(await api.request(id)); setError(null); setUpdatedAt(new Date().toISOString()); }
    catch (e) { setError(e instanceof ApiFailure ? (e.status === 404 ? "This case was not found or you don't have access." : e.message) : "Could not load the case"); }
  }, [id]);

  const [cancelling, setCancelling] = useState(false);
  async function cancel() {
    if (!window.confirm("Cancel this request? Donors who were alerted will be told it is no longer needed.")) return;
    setCancelling(true);
    try { await api.closeRequest(id, "CANCELLED"); toast("Request cancelled"); await load(); }
    catch (e) { toast(e instanceof ApiFailure ? e.message : "Could not cancel", { error: true }); }
    finally { setCancelling(false); }
  }

  useEffect(() => {
    if (!me) return;
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [me, load]);

  if (!me) return null;
  if (error && !data) return <div className="stack"><PageHeader title="Case" back="/requests" /><ErrorCard message={error} onRetry={() => void load()} /></div>;
  if (!data) return <div className="stack"><Skeleton h={40} /><Skeleton h={180} /><Skeleton h={260} /></div>;

  const r = data.request;
  const v = VERIFICATION_LABEL[r.verification];

  return (
    <div className="stack fade-up" style={{ gap: 16 }}>
      <PageHeader title={shortId(r.id)} subtitle={`Raised ${timeAgo(r.createdAt)}`} back="/requests"
        action={<button className="icon-btn" onClick={() => void load()} aria-label="Refresh"><IconRefresh width={18} /></button>} />

      {isNew && (
        <div className="glass card row" style={{ gap: 12, borderColor: "rgba(52,211,153,.35)", background: "rgba(52,211,153,.08)" }}>
          <span style={{ fontSize: 26 }}>✅</span>
          <div className="small"><strong>Request created.</strong> <span className="muted">Call the nearest centre below. Donor outreach starts after verification.</span></div>
        </div>
      )}

      <section className="glass card-lg glow stack" style={{ gap: 14, background: "linear-gradient(135deg, rgba(255,77,109,.2), rgba(127,13,36,.18))" }}>
        <div className="row" style={{ gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, display: "grid", placeItems: "center", fontSize: 24, fontWeight: 900, background: "linear-gradient(135deg, var(--red-2), var(--red))" }}>{r.bloodGroup}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 850 }}>{r.units} × {COMPONENT_LABEL[r.component]}</div>
            <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.hospitalName}</div>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <Chip tone="red" live={r.status !== "CLOSED"}>{STATUS_LABEL[r.status]}</Chip>
          <Chip tone={v.tone}>{v.text}</Chip>
          {r.outcome && <Chip tone="green">{r.outcome.toLowerCase()}</Chip>}
          {r.isSimulated && <Chip>demo case</Chip>}
        </div>
        <div className="row between small"><span className="muted">Needed by</span><strong>{formatWhen(r.neededBy)}</strong></div>
      </section>

      {r.verification === "PENDING_REVIEW" && (
        <div className="glass card row" style={{ gap: 12, alignItems: "flex-start" }}>
          <IconShield width={22} style={{ color: "var(--amber)", flex: "0 0 auto" }} />
          <div className="small"><strong>Awaiting verification.</strong> <span className="muted">A coordinator or the hospital confirms the request. Then matched donors get a WhatsApp alert in small waves.</span></div>
        </div>
      )}

      <Journey data={data} />

      <section className="stack" style={{ gap: 10 }}>
        <div className="row between"><h2 className="h3" style={{ fontSize: 17 }}>Nearby blood centres</h2><span className="tiny faint">refreshed {timeAgo(updatedAt)}</span></div>
        <CentreList hospitalId={r.hospitalId} bloodGroup={r.bloodGroup} component={r.component} />
      </section>

      <div className="glass card row small" style={{ gap: 12 }}>
        <IconWhatsApp width={22} style={{ color: "#25d366", flex: "0 0 auto" }} />
        <span className="muted">Donors never see your phone number. They respond on WhatsApp and go to a licensed blood centre with your case ID.</span>
      </div>
      {r.status !== "CLOSED" && !isStaff(me) && (
        <button className="btn btn-ghost btn-block" onClick={() => void cancel()} disabled={cancelling}>
          {cancelling ? "Cancelling…" : "No longer needed? Cancel this request"}
        </button>
      )}
      {r.isSimulated && <SimulatedNote />}
    </div>
  );
}

export default function TrackPage() {
  return <Suspense fallback={null}><TrackInner /></Suspense>;
}
