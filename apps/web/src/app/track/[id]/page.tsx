"use client";
import { use, useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, Shell, C, api, label } from "../../ui.tsx";

interface Detail { request: { id: string; status: string; verification: string; hospitalId: string; hospitalName: string; bloodGroup: string; component: string; units: number; neededBy: string; isSimulated?: boolean }; events: Array<{ id: string; fromStatus: string | null; toStatus: string; createdAt: string }> }
interface Centre { centreId: string; name: string; distanceKm: number; isSimulated?: boolean; stock: { units: number; status: string; updatedAt: string; isSimulated: boolean } | null }

const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

export default function Track({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detail | null>(null);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const detail = await api<Detail>(`/api/requests/${id}`);
      setD(detail);
      if (detail.request.component !== "UNKNOWN") {
        const q = new URLSearchParams({ hospitalId: detail.request.hospitalId, bloodGroup: detail.request.bloodGroup, component: detail.request.component });
        setCentres((await api<{ centres: Centre[] }>(`/api/centres?${q}`)).centres.slice(0, 6));
      }
    } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  const cancel = async () => { try { await api(`/api/requests/${id}/close`, { method: "POST", body: { outcome: "CANCELLED" } }); await load(); } catch (e) { setError((e as Error).message); } };

  return (
    <Shell>
      <ErrorText error={error} />
      {d && (
        <>
          <h1 style={{ marginBottom: 4 }}>{d.request.bloodGroup} · {d.request.units} unit(s)</h1>
          <p style={{ marginTop: 0, color: C.muted }}>{d.request.hospitalName} · needed by {new Date(d.request.neededBy).toLocaleString("en-IN")}</p>
          <Badge tone={d.request.verification === "VERIFIED" ? "ok" : "warn"}>{label(d.request.verification)}</Badge>
          <Badge tone={d.request.status === "CLOSED" ? "muted" : "red"}>{label(d.request.status)}</Badge>
          {d.request.verification !== "VERIFIED" && d.request.status !== "CLOSED" && <p style={{ fontSize: 14 }}>A coordinator or hospital staff will verify this request before donors are alerted. Meanwhile, call a centre below.</p>}
          <Card>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Nearby blood centres</h2>
            {centres.map((c) => (
              <div key={c.centreId} style={{ padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                <strong>{c.name}</strong> {c.isSimulated && <Badge>fictional</Badge>}<br />
                <span style={{ fontSize: 14, color: C.muted }}>{c.distanceKm} km straight-line · {c.stock ? `${c.stock.units} unit(s) ${c.stock.status.toLowerCase()}${c.stock.isSimulated ? " (simulated)" : ""}, updated ${ago(c.stock.updatedAt)}` : "no stock report"}</span>
              </div>
            ))}
          </Card>
          <Card>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Timeline</h2>
            <ol style={{ paddingLeft: 18, margin: 0 }}>{d.events.map((e) => <li key={e.id} style={{ margin: "4px 0" }}>{label(e.toStatus)} <span style={{ color: C.muted, fontSize: 13 }}>· {new Date(e.createdAt).toLocaleTimeString("en-IN")}</span></li>)}</ol>
          </Card>
          {d.request.status !== "CLOSED" && <Button kind="ghost" onClick={cancel}>Cancel request</Button>}
        </>
      )}
    </Shell>
  );
}