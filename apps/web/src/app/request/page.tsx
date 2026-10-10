"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, Field, Shell, C, COMPONENTS, GROUPS, api, input } from "../ui.tsx";
import { useMe } from "../useMe.ts";

interface Hospital { id: string; name: string; district: string; isSimulated: boolean }

export default function RequestBlood() {
  const { me } = useMe();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [form, setForm] = useState({ hospitalId: "", bloodGroup: "B+", component: "PACKED_RED_CELLS", units: 1, hours: 12 });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());

  useEffect(() => { api<{ hospitals: Hospital[] }>("/api/centres").then((d) => { setHospitals(d.hospitals); setForm((f) => ({ ...f, hospitalId: d.hospitals[0]?.id ?? "" })); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (me && !me.signedIn) window.location.href = "/login?returnTo=/request"; }, [me]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const neededBy = new Date(Date.now() + form.hours * 3_600_000).toISOString();
      const r = await api<{ request: { id: string } }>("/api/requests", { method: "POST", headers: { "idempotency-key": key }, body: { hospitalId: form.hospitalId, bloodGroup: form.bloodGroup, component: form.component, units: form.units, neededBy, language: "en", confirmed: true } });
      window.location.href = `/track/${r.request.id}`;
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const hospital = hospitals.find((h) => h.id === form.hospitalId);

  return (
    <Shell>
      <h1>Request blood</h1>
      <p style={{ color: C.muted }}>You&apos;ll see nearby blood centres immediately. Donors are alerted after hospital staff or a coordinator verify the request.</p>
      <ErrorText error={error} />
      {!confirming ? (
        <Card>
          <Field label="Hospital where the patient is admitted">
            <select style={input} value={form.hospitalId} onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}>
              {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.district}</option>)}
            </select>
          </Field>
          <Field label="Blood group">
            <div>{GROUPS.map((g) => <Button key={g} kind={form.bloodGroup === g ? "primary" : "ghost"} onClick={() => setForm({ ...form, bloodGroup: g })}>{g}</Button>)}</div>
          </Field>
          <Field label="Component" hint="Ask the doctor if unsure. We never suggest substitutes.">
            <select style={input} value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value })}>
              {COMPONENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Units"><input style={input} type="number" min={1} max={20} value={form.units} onChange={(e) => setForm({ ...form, units: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></Field>
          <Field label="Needed within"><select style={input} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}>{[2, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></Field>
          <Button onClick={() => setConfirming(true)} disabled={!form.hospitalId}>Review</Button>
        </Card>
      ) : (
        <Card style={{ borderColor: C.red }}>
          <h2 style={{ marginTop: 0 }}>Please confirm</h2>
          <p>🏥 {hospital?.name} {hospital?.isSimulated && <Badge>fictional</Badge>}<br />🩸 {form.bloodGroup} · {COMPONENTS.find(([v]) => v === form.component)?.[1]} · {form.units} unit(s)<br />⏰ within {form.hours} hours</p>
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Confirm request"}</Button>
          <Button kind="ghost" onClick={() => setConfirming(false)}>Edit</Button>
        </Card>
      )}
    </Shell>
  );
}