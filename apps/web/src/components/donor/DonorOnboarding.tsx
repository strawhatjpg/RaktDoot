"use client";
// Donor onboarding: consent step → profile (PUT /api/donors). New donors start PAUSED (M2 rule).
import { useState } from "react";
import type { BloodGroup, DonorProfileDTO, DonorSex } from "@raktdoot/shared";
import { api, ApiFailure } from "../../lib/api.ts";
import { BloodGroupPicker } from "../request/Pickers.tsx";
import { useToast } from "../Toast.tsx";
import { ConsentStep } from "./ConsentStep.tsx";

export function DonorOnboarding({ termsVersion, termsAccepted, onDone }: { termsVersion: string; termsAccepted: boolean; onDone: (p: DonorProfileDTO) => void }) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(termsAccepted ? 2 : 1);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [sex, setSex] = useState<DonorSex>("UNSPECIFIED");
  const [radius, setRadius] = useState(10);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);

  async function register() {
    if (!bloodGroup || !adult) return;
    setBusy(true);
    try {
      const profile = await api.saveDonor({ bloodGroup, sex, travelRadiusKm: radius, ageConfirmed: true });
      toast("Welcome, donor! Turn on availability when you're ready.");
      onDone(profile);
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "TERMS_REQUIRED") setStep(1);
      toast(e instanceof ApiFailure ? e.message : "Could not register", { error: true });
    } finally { setBusy(false); }
  }

  return (
    <div className="stack fade-up" style={{ gap: 16 }}>
      <div className="row" style={{ gap: 8 }}>
        {[1, 2].map((n) => <span key={n} style={{ flex: 1, height: 5, borderRadius: 4, background: step >= n ? "linear-gradient(90deg, var(--red-2), var(--red))" : "var(--surface-2)" }} />)}
      </div>
      {step === 1 ? <ConsentStep termsVersion={termsVersion} onDone={() => setStep(2)} /> : (
        <>
          <div><h1 className="h2" style={{ fontSize: 28 }}>Your donor profile</h1><p className="muted" style={{ margin: "6px 0 0" }}>Used only to match you to nearby verified needs.</p></div>
          <div><span className="label">Blood group</span><BloodGroupPicker value={bloodGroup} onChange={setBloodGroup} /></div>
          <div>
            <span className="label">Sex (sets the provisional 90 / 120-day reminder)</span>
            <div className="grid-3" style={{ gap: 8 }}>
              {(["MALE", "FEMALE", "UNSPECIFIED"] as const).map((s) => (
                <button key={s} type="button" className="pill pill-wide" aria-pressed={sex === s} onClick={() => setSex(s)}>{s === "UNSPECIFIED" ? "Prefer not to say" : s[0] + s.slice(1).toLowerCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">How far can you travel? <strong style={{ color: "var(--text)" }}>{radius} km</strong></span>
            <input type="range" min={1} max={50} value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: "100%", accentColor: "#e11d48" }} aria-label="Travel radius in km" />
          </div>
          <label className="glass card row" style={{ gap: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} style={{ width: 22, height: 22, accentColor: "#e11d48", flex: "0 0 auto" }} />
            <span className="small"><strong>I am 18 or older.</strong> <span className="muted">Final eligibility is decided at the blood centre.</span></span>
          </label>
          <button className="btn btn-primary btn-block" disabled={!bloodGroup || !adult || busy} onClick={() => void register()}>{busy ? "Registering…" : "Register as donor"}</button>
        </>
      )}
    </div>
  );
}
