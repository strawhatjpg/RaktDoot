"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, Shell, C, api, label } from "../ui.tsx";
import { useMe } from "../useMe.ts";

interface QueueItem { id: string; hospitalName: string; bloodGroup: string; component: string; units: number; neededBy: string; isSimulated: boolean }
interface Candidate { donorId: string; displayName: string; distanceKm: number; score: number; reasons: string[] }
interface Outreach { status: string; verification: string; units: number; acceptedCount: number; issuedUnits: number; waves: Array<{ waveNumber: number; radiusKm: number; size: number; closed: boolean }>; invites: Array<{ inviteId: string; displayName: string; distanceKm: number; reasons: string[]; status: string }> }

export default function Dashboard() {
  const { me } = useMe();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [caseId, setCaseId] = useState("");
  const [matches, setMatches] = useState<{ candidates: Candidate[]; excluded: Record<string, number> } | null>(null);
  const [outreach, setOutreach] = useState<Outreach | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(async () => { try { setQueue((await api<{ queue: QueueItem[] }>("/api/verification")).queue); } catch (e) { setError((e as Error).message); } }, []);
  const loadCase = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setOutreach(await api<Outreach>(`/api/requests/${id}/outreach`));
      setMatches(await api(`/api/requests/${id}/matches`));
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (me?.signedIn && me.user?.verifiedStaff) void loadQueue(); else if (me && !me.signedIn) window.location.href = "/login?returnTo=/dashboard"; }, [me, loadQueue]);
  useEffect(() => { if (!caseId) return; void loadCase(caseId); const t = setInterval(() => loadCase(caseId), 4000); return () => clearInterval(t); }, [caseId, loadCase]);

  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setError(null); try { await fn(); await loadQueue(); await loadCase(caseId); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const verify = (id: string) => act(async () => { await api(`/api/requests/${id}/verify`, { method: "POST", body: { decision: "VERIFIED", method: "Confirmed with the treating hospital's blood bank" } }); setCaseId(id); });
  const reject = (id: string) => act(() => api(`/api/requests/${id}/verify`, { method: "POST", body: { decision: "REJECTED", method: "Hospital could not confirm the patient" } }));
  const wave = () => act(() => api(`/api/requests/${caseId}/outreach`, { method: "POST" }));
  const outcome = (inviteId: string, o: string) => act(() => api(`/api/invites/${inviteId}/outcome`, { method: "POST", body: { outcome: o } }));
  const issue = () => act(() => api(`/api/requests/${caseId}/fulfilment`, { method: "POST", body: { units: outreach?.units ?? 1, source: "DONOR_DONATION" } }));
  const close = () => act(() => api(`/api/requests/${caseId}/close`, { method: "POST", body: { outcome: "FULFILLED" } }));

  if (me?.signedIn && !me.user?.verifiedStaff) return <Shell><Card>This dashboard is for verified hospital staff and coordinators.</Card></Shell>;
  return (
    <Shell wide>
      <h1>Coordinator dashboard</h1>
      <ErrorText error={error} />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(260px, 1fr) 2fr" }}>
        <div>
          <Card>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Awaiting verification ({queue.length})</h2>
            {queue.length === 0 && <p style={{ color: C.muted, fontSize: 14 }}>Nothing pending.</p>}
            {queue.map((q) => (
              <div key={q.id} style={{ borderTop: `1px solid ${C.line}`, padding: "8px 0" }}>
                <strong>{q.bloodGroup}</strong> · {label(q.component)} · {q.units} unit(s) {q.isSimulated && <Badge>fictional</Badge>}<br />
                <span style={{ fontSize: 13, color: C.muted }}>{q.hospitalName} · by {new Date(q.neededBy).toLocaleString("en-IN")}</span><br />
                <Button onClick={() => verify(q.id)} disabled={busy}>Verify</Button>
                <Button kind="ghost" onClick={() => reject(q.id)} disabled={busy}>Reject</Button>
                <Button kind="ghost" onClick={() => setCaseId(q.id)}>Open</Button>
              </div>
            ))}
          </Card>
        </div>
        <div>
          {!caseId && <Card><p style={{ color: C.muted }}>Verify a request to open its case.</p></Card>}
          {caseId && outreach && (
            <Card>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Case {caseId.slice(-8).toUpperCase()} <Badge tone={outreach.verification === "VERIFIED" ? "ok" : "warn"}>{label(outreach.verification)}</Badge><Badge tone="red">{label(outreach.status)}</Badge></h2>
              <p>Donors committed <strong>{outreach.acceptedCount}/{outreach.units}</strong> · units issued <strong>{outreach.issuedUnits}/{outreach.units}</strong></p>
              {outreach.status !== "CLOSED" && <>
                <Button onClick={wave} disabled={busy || outreach.verification !== "VERIFIED" || outreach.acceptedCount >= outreach.units}>📲 Alert nearby donors on WhatsApp (wave {outreach.waves.length + 1})</Button>
                <Button kind="secondary" onClick={issue} disabled={busy || outreach.issuedUnits >= outreach.units}>Record units issued</Button>
                <Button kind="secondary" onClick={close} disabled={busy || outreach.issuedUnits < outreach.units}>Close as fulfilled</Button>
              </>}
              {outreach.waves.map((w) => <p key={w.waveNumber} style={{ fontSize: 13, color: C.muted, margin: "8px 0 0" }}>Wave {w.waveNumber}: {w.size} donor(s) within {w.radiusKm} km {w.closed ? "· closed" : "· open"}</p>)}
              <h3 style={{ fontSize: 16 }}>Donor responses</h3>
              {outreach.invites.length === 0 && <p style={{ fontSize: 14, color: C.muted }}>No donors alerted yet.</p>}
              {outreach.invites.map((i) => (
                <div key={i.inviteId} style={{ borderTop: `1px solid ${C.line}`, padding: "6px 0", fontSize: 14 }}>
                  <strong>{i.displayName}</strong> · {i.distanceKm} km <Badge tone={i.status === "ACCEPTED" || i.status === "DONATED" ? "ok" : i.status === "INVITED" ? "warn" : "muted"}>{label(i.status)}</Badge>
                  {i.status === "ACCEPTED" && <Button kind="ghost" onClick={() => outcome(i.inviteId, "ARRIVED")}>Arrived</Button>}
                  {(i.status === "ACCEPTED" || i.status === "ARRIVED") && <><Button kind="ghost" onClick={() => outcome(i.inviteId, "DONATED")}>Donated</Button><Button kind="ghost" onClick={() => outcome(i.inviteId, "DEFERRED")}>Deferred</Button></>}
                </div>
              ))}
              {matches && outreach.status !== "CLOSED" && (
                <>
                  <h3 style={{ fontSize: 16 }}>Next best matches (explained)</h3>
                  {matches.candidates.length === 0 && <p style={{ fontSize: 14, color: C.muted }}>No eligible donors left in range.</p>}
                  {matches.candidates.map((m) => <div key={m.donorId} style={{ fontSize: 13, padding: "4px 0" }}><strong>{m.displayName}</strong> · score {m.score.toFixed(2)} — {m.reasons.join("; ")}</div>)}
                  {Object.keys(matches.excluded).length > 0 && <p style={{ fontSize: 12, color: C.muted }}>Excluded: {Object.entries(matches.excluded).map(([k, v]) => `${label(k)} ${v}`).join(" · ")}</p>}
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}