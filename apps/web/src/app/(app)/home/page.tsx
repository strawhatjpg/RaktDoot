"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BloodRequestDTO, DonorProfileDTO } from "@raktdoot/shared";
import { Drop } from "../../../components/Drop.tsx";
import { IconArrow, IconHeart, IconPlus, IconShield, IconWhatsApp } from "../../../components/icons.tsx";
import { useRequireSession } from "../../../components/Session.tsx";
import { Chip, Skeleton } from "../../../components/Ui.tsx";
import { api } from "../../../lib/api.ts";
import { COMPONENT_LABEL, STATUS_LABEL, VERIFICATION_LABEL, shortId, timeAgo } from "../../../lib/format.ts";

export default function HomePage() {
  const { me } = useRequireSession();
  const [requests, setRequests] = useState<BloodRequestDTO[] | null>(null);
  const [donor, setDonor] = useState<DonorProfileDTO | null | undefined>(undefined);

  useEffect(() => {
    if (!me) return;
    api.myRequests().then(setRequests).catch(() => setRequests([]));
    api.donor().then(setDonor).catch(() => setDonor(null));
  }, [me]);

  const active = requests?.filter((r) => r.status !== "CLOSED") ?? [];
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="stack fade-up" style={{ gap: 18 }}>
      <div>
        <p className="muted small" style={{ margin: 0 }}>{greeting}</p>
        <h1 className="h2" style={{ fontSize: 30 }}>{me?.name && me.name !== "RaktDoot user" ? me.name.split(" ")[0] : "Welcome"} 👋</h1>
      </div>

      <Link href="/request/new" className="glass glow hover-lift" style={{ padding: 22, borderRadius: 24, background: "linear-gradient(135deg, rgba(255,77,109,.35), rgba(127,13,36,.35))", borderColor: "rgba(255,77,109,.35)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ color: "#ffd0d9" }}>Need blood?</div>
          <div style={{ fontSize: 22, fontWeight: 850, marginTop: 6 }}>Request in under a minute</div>
          <div className="small" style={{ color: "#ffd9e0", marginTop: 6 }}>Type or speak in your language. Nearby centres appear instantly.</div>
        </div>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,.15)", display: "grid", placeItems: "center" }}><IconPlus width={28} /></div>
      </Link>

      <section className="stack" style={{ gap: 10 }}>
        <div className="row between">
          <h2 className="h3">Active cases</h2>
          <Link href="/requests" className="small muted">See all</Link>
        </div>
        {requests === null ? <Skeleton h={88} /> : active.length === 0 ? (
          <div className="glass card row" style={{ gap: 14 }}>
            <Drop size={30} />
            <span className="muted small">No active requests. When you raise one, its live status appears here.</span>
          </div>
        ) : active.slice(0, 3).map((r) => (
          <Link key={r.id} href={`/track/${r.id}`} className="glass card hover-lift row" style={{ gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(225,29,72,.18)", border: "1px solid rgba(255,77,109,.3)", fontWeight: 850, fontSize: 18 }}>{r.bloodGroup}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 750 }}>{r.units} × {COMPONENT_LABEL[r.component]}</div>
              <div className="tiny muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.hospitalName} · {shortId(r.id)} · {timeAgo(r.createdAt)}</div>
              <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                <Chip tone="red" live>{STATUS_LABEL[r.status]}</Chip>
                <Chip tone={VERIFICATION_LABEL[r.verification].tone}>{VERIFICATION_LABEL[r.verification].text}</Chip>
              </div>
            </div>
            <IconArrow width={18} className="faint" />
          </Link>
        ))}
      </section>

      <Link href="/donor" className="glass card hover-lift row" style={{ gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(45,212,191,.14)", color: "var(--teal)" }}><IconHeart width={22} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 750 }}>{donor ? "Your donor profile" : "Become a donor"}</div>
          <div className="tiny muted">
            {donor === undefined ? "Loading…" : donor ? `${donor.bloodGroup} · ${donor.effectiveAvailability === "AVAILABLE" ? "Available for alerts" : "Alerts paused"}` : "Get WhatsApp alerts only for verified needs near you"}
          </div>
        </div>
        {donor?.effectiveAvailability === "AVAILABLE" ? <Chip tone="green" live>Active</Chip> : <IconArrow width={18} className="faint" />}
      </Link>

      <div className="grid-2">
        <div className="glass card stack" style={{ gap: 8 }}>
          <IconShield width={22} style={{ color: "var(--violet)" }} />
          <strong className="small">Verified before outreach</strong>
          <span className="tiny muted">Donors are contacted only after a hospital or coordinator confirms your request.</span>
        </div>
        <Link href="/simulator" className="glass card stack hover-lift" style={{ gap: 8 }}>
          <IconWhatsApp width={22} style={{ color: "#25d366" }} />
          <strong className="small">Donor alerts on WhatsApp</strong>
          <span className="tiny muted">See what donors receive. Try the live bot simulator →</span>
        </Link>
      </div>
    </div>
  );
}
