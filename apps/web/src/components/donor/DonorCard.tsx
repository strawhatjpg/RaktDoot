"use client";
// Donor hero card + availability switcher (PUT /api/donors/availability) + provisional reminder ring.
import { useState } from "react";
import type { DonorProfileDTO } from "@raktdoot/shared";
import { api, ApiFailure } from "../../lib/api.ts";
import { formatDate } from "../../lib/format.ts";
import { Drop } from "../Drop.tsx";
import { useToast } from "../Toast.tsx";

const AVAIL = [
  { v: "AVAILABLE", label: "Available", tone: "var(--green)", hint: "You can receive verified alerts" },
  { v: "PAUSED", label: "Paused", tone: "var(--amber)", hint: "No alerts until you resume" },
  { v: "UNAVAILABLE", label: "Away 2 weeks", tone: "var(--faint)", hint: "Auto-pauses after the date" },
] as const;

export function DonorCard({ profile, name, onChange }: { profile: DonorProfileDTO; name: string; onChange: (p: DonorProfileDTO) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const current = AVAIL.find((a) => a.v === profile.effectiveAvailability) ?? AVAIL[1];

  async function setAvail(v: (typeof AVAIL)[number]["v"]) {
    setBusy(true);
    try {
      const until = v === "UNAVAILABLE" ? new Date(Date.now() + 14 * 86_400_000).toISOString() : undefined;
      onChange(await api.setAvailability(v, until));
      toast(v === "AVAILABLE" ? "You're available. Thank you! 🩸" : v === "PAUSED" ? "Alerts paused" : "Marked away for 2 weeks");
    } catch (e) { toast(e instanceof ApiFailure ? e.message : "Could not update", { error: true }); }
    finally { setBusy(false); }
  }

  const next = profile.provisionalNextReviewAt ? new Date(profile.provisionalNextReviewAt) : null;
  const last = profile.lastDonationAt ? new Date(profile.lastDonationAt) : null;
  const total = next && last ? next.getTime() - last.getTime() : 1;
  const pct = next && last ? Math.min(1, Math.max(0, (Date.now() - last.getTime()) / total)) : 1;
  const daysLeft = next ? Math.max(0, Math.ceil((next.getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <>
      <section className="glass card-lg glow" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #3a0a16 0%, #7f0d24 55%, #e11d48 130%)", borderColor: "rgba(255,77,109,.4)" }}>
        <div style={{ position: "absolute", right: -30, top: -20, opacity: 0.18 }}><Drop size={200} /></div>
        <div className="row between" style={{ position: "relative" }}>
          <span className="eyebrow" style={{ color: "#ffd0d9" }}>RaktDoot donor</span>
          <span className="chip" style={{ background: "rgba(0,0,0,.25)", color: current.tone, borderColor: "rgba(255,255,255,.15)" }}><span className="dot dot-live" />{current.label}</span>
        </div>
        <div className="row" style={{ gap: 18, marginTop: 18, position: "relative" }}>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>{profile.bloodGroup}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{name}</div>
            <div className="small" style={{ color: "#ffd9e0" }}>Within {profile.travelRadiusKm} km · {profile.location?.areaLabel ?? "area not set"}</div>
          </div>
        </div>
      </section>

      <section className="glass card stack" style={{ gap: 10 }}>
        <strong>Availability</strong>
        <div className="grid-3" style={{ gap: 8 }}>
          {AVAIL.map((a) => (
            <button key={a.v} className="pill pill-wide" aria-pressed={profile.effectiveAvailability === a.v} disabled={busy} onClick={() => void setAvail(a.v)}>{a.label}</button>
          ))}
        </div>
        <span className="tiny muted">{current.hint}{profile.unavailableUntil && profile.availability === "UNAVAILABLE" ? ` · until ${formatDate(profile.unavailableUntil)}` : ""}</span>
      </section>

      <section className="glass card row" style={{ gap: 16 }}>
        <div style={{ width: 74, height: 74, borderRadius: "50%", flex: "0 0 auto", display: "grid", placeItems: "center", background: `conic-gradient(var(--red-2) ${pct * 360}deg, rgba(255,255,255,.08) 0)` }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--surface-solid)", display: "grid", placeItems: "center", fontWeight: 850 }}>{next && daysLeft > 0 ? `${daysLeft}d` : "✓"}</div>
        </div>
        <div className="small">
          <strong>{next && daysLeft > 0 ? `You may be eligible again in ${daysLeft} days` : "You may be eligible to donate"}</strong>
          <div className="muted tiny" style={{ marginTop: 4 }}>{last ? `Last donation ${formatDate(profile.lastDonationAt)}. ` : ""}Provisional reminder only. The blood centre&apos;s screening decides.</div>
        </div>
      </section>
    </>
  );
}
