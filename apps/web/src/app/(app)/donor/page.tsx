"use client";
// Donor hub: onboarding when not registered, otherwise card + availability + location + permissions.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ConsentStateDTO, DonorProfileDTO } from "@raktdoot/shared";
import { ConsentManager, isGranted } from "../../../components/donor/ConsentManager.tsx";
import { DonorCard } from "../../../components/donor/DonorCard.tsx";
import { DonorOnboarding } from "../../../components/donor/DonorOnboarding.tsx";
import { LocationCard } from "../../../components/donor/LocationCard.tsx";
import { IconWhatsApp } from "../../../components/icons.tsx";
import { useRequireSession } from "../../../components/Session.tsx";
import { ErrorCard, Skeleton } from "../../../components/Ui.tsx";
import { api, ApiFailure } from "../../../lib/api.ts";

export default function DonorPage() {
  const { me, refresh } = useRequireSession();
  const [profile, setProfile] = useState<DonorProfileDTO | null | undefined>(undefined);
  const [consent, setConsent] = useState<ConsentStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const c = await api.consent();
      setConsent(c);
      try { setProfile(await api.donor()); }
      catch (e) { if (e instanceof ApiFailure && e.code === "DONOR_NOT_REGISTERED") setProfile(null); else throw e; }
    } catch (e) { setError(e instanceof ApiFailure ? e.message : "Could not load your donor profile"); }
  }, []);

  useEffect(() => { if (me) void load(); }, [me, load]);

  if (!me) return null;
  if (error) return <ErrorCard message={error} onRetry={() => void load()} />;
  if (profile === undefined || !consent) return <div className="stack"><Skeleton h={170} /><Skeleton h={110} /><Skeleton h={110} /></div>;

  if (profile === null) {
    return <DonorOnboarding termsVersion={consent.currentTermsVersion} termsAccepted={isGranted(consent, "TERMS", null)}
      onDone={(p) => { setProfile(p); void refresh(); void api.consent().then(setConsent); }} />;
  }

  const locationConsent = isGranted(consent, "LOCATION_STORAGE", null);
  const displayName = me.name && me.name !== "RaktDoot user" ? me.name : "Life-saver";

  return (
    <div className="stack fade-up" style={{ gap: 14 }}>
      <DonorCard profile={profile} name={displayName} onChange={setProfile} />
      <LocationCard profile={profile} consented={locationConsent} onChange={setProfile} />
      <ConsentManager state={consent} onChange={(s) => { setConsent(s); void api.donor().then(setProfile).catch(() => undefined); }} />
      <Link href="/simulator" className="glass card row hover-lift" style={{ gap: 14 }}>
        <IconWhatsApp width={26} style={{ color: "#25d366", flex: "0 0 auto" }} />
        <div className="small"><strong>Alerts arrive on WhatsApp</strong><div className="tiny muted">No app needed for donors. Preview the bot in the simulator →</div></div>
      </Link>
    </div>
  );
}
