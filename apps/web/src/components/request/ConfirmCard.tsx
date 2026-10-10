"use client";
import type { BloodComponent, BloodGroup, LanguageCode } from "@raktdoot/shared";
import { COMPONENT_LABEL, formatWhen } from "../../lib/format.ts";
import { PageHeader } from "../Ui.tsx";

const LANG_NAME: Record<LanguageCode, string> = { en: "English", hi: "हिन्दी", "hi-Latn": "Hinglish", mr: "मराठी" };

export function ConfirmCard(props: {
  bloodGroup: BloodGroup; component: BloodComponent; units: number; neededBy: string; hospitalName: string; language: LanguageCode;
  submitting: boolean; onConfirm: () => void; onEdit: () => void;
}) {
  const { bloodGroup, component, units, neededBy, hospitalName, language, submitting } = props;
  return (
    <div className="stack fade-up" style={{ gap: 16 }}>
      <PageHeader title="Confirm your request" subtitle="Please check every detail. Hospital staff will verify it." />
      <section className="glass card-lg glow stack" style={{ gap: 14, borderColor: "rgba(255,77,109,.35)" }}>
        <div className="row" style={{ gap: 14 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 900, background: "linear-gradient(135deg, var(--red-2), var(--red))", boxShadow: "0 12px 30px -10px rgba(225,29,72,.9)" }}>{bloodGroup}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 850 }}>{units} unit{units > 1 ? "s" : ""}</div>
            <div className="muted">{COMPONENT_LABEL[component]}</div>
          </div>
        </div>
        <hr className="divider" />
        <Row k="Hospital" v={hospitalName} />
        <Row k="Needed by" v={formatWhen(neededBy)} />
        <Row k="Language" v={LANG_NAME[language]} />
      </section>
      <div className="banner">Private donors are contacted <strong>only after verification</strong> by the hospital or a coordinator. Nearby blood centres are shown to you right away.</div>
      <button className="btn btn-primary btn-block" onClick={props.onConfirm} disabled={submitting}>{submitting ? "Creating…" : "Confirm & create request"}</button>
      <button className="btn btn-ghost btn-block" onClick={props.onEdit} disabled={submitting}>Edit details</button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="row between small"><span className="muted">{k}</span><strong style={{ textAlign: "right" }}>{v}</strong></div>;
}
