"use client";
// New blood request: AI prefill → editable form → confirm card → POST /api/requests → track page.
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { CentreList } from "../../../../components/CentreList.tsx";
import { AiIntake } from "../../../../components/request/AiIntake.tsx";
import { ConfirmCard } from "../../../../components/request/ConfirmCard.tsx";
import { BloodGroupPicker, ComponentPicker, NeededByPicker, UnitsStepper } from "../../../../components/request/Pickers.tsx";
import { useRequestForm } from "../../../../components/request/useRequestForm.ts";
import { useRequireSession } from "../../../../components/Session.tsx";
import { useToast } from "../../../../components/Toast.tsx";
import { PageHeader, SimulatedNote } from "../../../../components/Ui.tsx";
import { api, ApiFailure, newIdempotencyKey } from "../../../../lib/api.ts";

export default function NewRequestPage() {
  const { me } = useRequireSession();
  const router = useRouter();
  const toast = useToast();
  const f = useRequestForm();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const idemKey = useRef(newIdempotencyKey());

  async function submit() {
    if (!f.bloodGroup || !f.component || !f.neededBy || !f.hospitalId) return;
    setSubmitting(true); setFieldErrors({});
    try {
      const { request } = await api.createRequest(
        { hospitalId: f.hospitalId, bloodGroup: f.bloodGroup, component: f.component, units: f.units, neededBy: f.neededBy, language: f.language, confirmed: true },
        idemKey.current,
      );
      toast("Request created. Nearby centres are listed.");
      router.push(`/track/${request.id}?new=1`);
    } catch (e) {
      if (e instanceof ApiFailure) {
        setFieldErrors(e.fields ?? {});
        toast(e.code === "UNAUTHENTICATED" ? "Please sign in again" : e.message, { error: true });
        if (e.code === "IDEMPOTENCY_CONFLICT") idemKey.current = newIdempotencyKey();
      } else toast("Could not create the request", { error: true });
      setConfirming(false);
    } finally { setSubmitting(false); }
  }

  if (!me) return null;

  if (confirming && f.bloodGroup && f.component && f.neededBy && f.hospital) {
    return <ConfirmCard bloodGroup={f.bloodGroup} component={f.component} units={f.units} neededBy={f.neededBy} hospitalName={f.hospital.name}
      language={f.language} submitting={submitting} onConfirm={() => void submit()} onEdit={() => setConfirming(false)} />;
  }

  return (
    <div className="stack fade-up" style={{ gap: 18 }}>
      <PageHeader title="Request blood" subtitle="Takes under a minute. You can type or speak." back="/home" />
      <AiIntake onExtracted={f.applyExtraction} />
      {f.aiNote && <div className="chip chip-violet" style={{ height: "auto", padding: "8px 12px", whiteSpace: "normal" }}>✨ {f.aiNote}</div>}

      <Field label="Treating hospital" error={fieldErrors.hospitalId}>
        <select className="select" value={f.hospitalId} onChange={(e) => f.setHospitalId(e.target.value)} aria-label="Treating hospital">
          <option value="">Select hospital…</option>
          {f.hospitals.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.district}</option>)}
        </select>
      </Field>
      <Field label="Blood group" error={fieldErrors.bloodGroup}><BloodGroupPicker value={f.bloodGroup} onChange={f.setBloodGroup} /></Field>
      <Field label="Component (ask the doctor if unsure)" error={fieldErrors.component}><ComponentPicker value={f.component} onChange={f.setComponent} /></Field>
      <Field label="Units" error={fieldErrors.units}><UnitsStepper value={f.units} onChange={f.setUnits} /></Field>
      <Field label="Needed by" error={fieldErrors.neededBy}><NeededByPicker value={f.neededBy} onChange={f.setNeededBy} /></Field>

      {f.hospitalId && f.bloodGroup && f.component && (
        <section className="stack" style={{ gap: 10 }}>
          <div className="row between"><h2 className="h3" style={{ fontSize: 17 }}>Nearby blood centres</h2><span className="chip chip-green">instant</span></div>
          <CentreList hospitalId={f.hospitalId} bloodGroup={f.bloodGroup} component={f.component} limit={3} />
        </section>
      )}
      {f.hospital?.isSimulated && <SimulatedNote />}

      <button className="btn btn-primary btn-block" disabled={f.missing.length > 0} onClick={() => setConfirming(true)}>
        {f.missing.length ? (f.missing.length > 1 ? `${f.missing.length} details missing` : `Add ${f.missing[0]}`) : "Review request"}
      </button>
      {f.missing.length > 1 && <p className="tiny faint" style={{ textAlign: "center", marginTop: -6 }}>Still needed: {f.missing.join(", ")}</p>}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <div><span className="label">{label}</span>{children}{error && <div className="field-error">{error}</div>}</div>;
}
