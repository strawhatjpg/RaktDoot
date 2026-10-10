"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, Field, Shell, C, GROUPS, api, input } from "../ui.tsx";
import { useMe } from "../useMe.ts";

interface Profile { bloodGroup: string; travelRadiusKm: number; availability: string; effectiveAvailability: string; provisionalNextReviewAt: string | null; location: { areaLabel: string | null; updatedAt: string; needsUpdate: boolean } | null }
interface ConsentState { currentTermsVersion: string; consents: Array<{ type: string; channel: string | null; granted: boolean }> }

export default function Donor() {
  const { me } = useMe();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [form, setForm] = useState({ bloodGroup: "B+", sex: "UNSPECIFIED", travelRadiusKm: 10, ageConfirmed: false });
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setConsent(await api<ConsentState>("/api/consent"));
      setProfile((await api<{ profile: Profile }>("/api/donors")).profile);
    } catch (e) { if (!(e as Error).message.includes("Register")) setError((e as Error).message); setProfile(null); }
  }, []);
  useEffect(() => { if (me?.signedIn) void load(); else if (me && !me.signedIn) window.location.href = "/login?returnTo=/donor"; }, [me, load]);

  const granted = (type: string, channel: string | null = null) => consent?.consents.find((c) => c.type === type && c.channel === channel)?.granted === true;
  const setConsentFlag = async (type: string, channel: string | null, value: boolean) => {
    try { setConsent(await api<ConsentState>("/api/consent", { method: "POST", body: { termsVersion: consent?.currentTermsVersion, updates: [{ type, channel, granted: value }] } })); await load(); }
    catch (e) { setError((e as Error).message); }
  };
  const register = async () => {
    setError(null);
    try {
      if (!granted("TERMS")) await setConsentFlag("TERMS", null, true);
      await api("/api/donors", { method: "PUT", body: form });
      await load();
    } catch (e) { setError((e as Error).message); }
  };
  const shareLocation = () => {
    setError(null);
    if (!navigator.geolocation) return setError("Location is not available in this browser");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { await api("/api/donors/location", { method: "PUT", body: { lat: pos.coords.latitude, lng: pos.coords.longitude, source: "APP_GPS" } }); setNote("Location saved at about 1 km precision."); await load(); }
      catch (e) { setError((e as Error).message); }
    }, () => setError("Location permission was denied"), { enableHighAccuracy: false, timeout: 10_000 });
  };
  const setAvailability = async (availability: string) => {
    try { await api("/api/donors/availability", { method: "PUT", body: { availability } }); await load(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <Shell>
      <h1>Become a donor</h1>
      <ErrorText error={error} />
      {note && <p style={{ color: C.ok }}>{note}</p>}
      {!profile ? (
        <Card>
          <Field label="Blood group"><div>{GROUPS.map((g) => <Button key={g} kind={form.bloodGroup === g ? "primary" : "ghost"} onClick={() => setForm({ ...form, bloodGroup: g })}>{g}</Button>)}</div></Field>
          <Field label="Sex (for the provisional donation interval)"><select style={input} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}><option value="UNSPECIFIED">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select></Field>
          <Field label="How far can you travel?"><select style={input} value={form.travelRadiusKm} onChange={(e) => setForm({ ...form, travelRadiusKm: Number(e.target.value) })}>{[5, 10, 15, 25, 50].map((k) => <option key={k} value={k}>{k} km</option>)}</select></Field>
          <label style={{ display: "block", margin: "12px 0" }}><input type="checkbox" checked={form.ageConfirmed} onChange={(e) => setForm({ ...form, ageConfirmed: e.target.checked })} /> I am 18 or older and accept the <a href="/terms">terms and privacy notice</a></label>
          <Button onClick={register} disabled={!form.ageConfirmed}>Register as donor</Button>
        </Card>
      ) : (
        <>
          <Card>
            <h2 style={{ marginTop: 0 }}>{profile.bloodGroup} donor <Badge tone={profile.effectiveAvailability === "AVAILABLE" ? "ok" : "warn"}>{profile.effectiveAvailability.toLowerCase()}</Badge></h2>
            {profile.provisionalNextReviewAt && <p style={{ fontSize: 14 }}>You may be eligible again from {new Date(profile.provisionalNextReviewAt).toLocaleDateString("en-IN")} (the blood centre confirms).</p>}
            <Button kind={profile.effectiveAvailability === "AVAILABLE" ? "primary" : "secondary"} onClick={() => setAvailability("AVAILABLE")}>Available</Button>
            <Button kind="ghost" onClick={() => setAvailability("PAUSED")}>Pause</Button>
          </Card>
          <Card>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Permissions</h2>
            <p style={{ fontSize: 14, color: C.muted }}>Each permission is separate and can be withdrawn anytime.</p>
            {!me?.user?.hasPhone && <p style={{ fontSize: 14, color: C.warn }}>To receive WhatsApp alerts, link your number: message our bot or use “Log in with WhatsApp” once.</p>}
            {([["URGENT_ALERTS", "WHATSAPP", "WhatsApp alerts when someone nearby needs my group"], ["DONATION_REMINDERS", "WHATSAPP", "WhatsApp reminders when I may be eligible again"], ["LOCATION_STORAGE", null, "Store my approximate area (~1 km)"]] as const).map(([type, channel, text]) => (
              <label key={type} style={{ display: "block", margin: "8px 0" }}><input type="checkbox" checked={granted(type, channel)} onChange={(e) => setConsentFlag(type, channel, e.target.checked)} /> {text}</label>
            ))}
          </Card>
          <Card>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Location</h2>
            <p style={{ fontSize: 14 }}>{profile.location ? `Saved ${new Date(profile.location.updatedAt).toLocaleDateString("en-IN")}${profile.location.needsUpdate ? " — please update" : ""}` : "Not shared yet"}</p>
            <Button kind="secondary" onClick={shareLocation} disabled={!granted("LOCATION_STORAGE")}>Use my current location</Button>
          </Card>
        </>
      )}
    </Shell>
  );
}