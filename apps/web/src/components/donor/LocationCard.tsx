"use client";
// One-shot GPS or typed area → PUT /api/donors/location (stored at ~1 km by M2). Delete anytime.
import { useState } from "react";
import type { DonorProfileDTO } from "@raktdoot/shared";
import { api, ApiFailure } from "../../lib/api.ts";
import { timeAgo } from "../../lib/format.ts";
import { IconPin } from "../icons.tsx";
import { useToast } from "../Toast.tsx";

// Small built-in lookup so typed areas work without a geocoding API (demo city: Pune).
const AREAS: Record<string, [number, number]> = {
  shivajinagar: [18.53, 73.85], kothrud: [18.51, 73.81], hadapsar: [18.5, 73.94], baner: [18.56, 73.79],
  viman: [18.57, 73.91], aundh: [18.56, 73.81], camp: [18.51, 73.88], wakad: [18.6, 73.76], pune: [18.52, 73.86],
};

export function LocationCard({ profile, consented, onChange }: { profile: DonorProfileDTO; consented: boolean; onChange: (p: DonorProfileDTO) => void }) {
  const toast = useToast();
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const loc = profile.location;

  async function save(lat: number, lng: number, source: "APP_GPS" | "MANUAL_ENTRY", label?: string) {
    setBusy(true);
    try { onChange(await api.setLocation(lat, lng, source, label)); toast("Location updated (~1 km precision)"); }
    catch (e) { toast(e instanceof ApiFailure ? e.message : "Could not save location", { error: true }); }
    finally { setBusy(false); }
  }

  function useGps() {
    if (!navigator.geolocation) { toast("GPS is not available. Type your area instead.", { error: true }); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => void save(p.coords.latitude, p.coords.longitude, "APP_GPS"),
      () => { setBusy(false); toast("Location permission denied. Type your area instead.", { error: true }); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function useTyped() {
    const key = Object.keys(AREAS).find((k) => area.toLowerCase().replace(/\s+/g, "").includes(k));
    if (!key) { toast("Area not recognised yet. Try a nearby locality or use GPS.", { error: true }); return; }
    const [lat, lng] = AREAS[key]!;
    void save(lat, lng, "MANUAL_ENTRY", area.trim().slice(0, 80));
  }

  async function remove() {
    setBusy(true);
    try { await api.deleteLocation(); onChange({ ...profile, location: null }); toast("Location deleted"); }
    catch (e) { toast(e instanceof ApiFailure ? e.message : "Could not delete", { error: true }); }
    finally { setBusy(false); }
  }

  return (
    <section className="glass card stack" style={{ gap: 12 }}>
      <div className="row between">
        <div className="row" style={{ gap: 8 }}><IconPin width={18} style={{ color: "var(--teal)" }} /><strong>Your area</strong></div>
        {loc?.needsUpdate && <span className="chip chip-amber">please refresh</span>}
      </div>
      {!consented ? (
        <p className="small muted" style={{ margin: 0 }}>Turn on &quot;Store my approximate location&quot; below to receive nearby alerts.</p>
      ) : loc ? (
        <div className="row between small">
          <span><strong>{loc.areaLabel ?? `${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)}`}</strong> <span className="muted">· {loc.source === "APP_GPS" ? "GPS" : loc.source === "MANUAL_ENTRY" ? "typed" : "WhatsApp pin"} · {timeAgo(loc.updatedAt)}</span></span>
          <button className="btn btn-ghost btn-sm" onClick={() => void remove()} disabled={busy}>Delete</button>
        </div>
      ) : <p className="small muted" style={{ margin: 0 }}>No location yet. You won&apos;t get nearby alerts until you add one.</p>}
      {consented && (
        <>
          <button className="btn btn-ghost btn-block" onClick={useGps} disabled={busy}><IconPin width={16} /> {busy ? "Updating…" : "Use my current location"}</button>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" placeholder="or type your area, e.g. Kothrud" value={area} maxLength={80} onChange={(e) => setArea(e.target.value)} aria-label="Area" />
            <button className="btn btn-ghost" onClick={useTyped} disabled={busy || area.trim().length < 2}>Save</button>
          </div>
          <p className="tiny faint" style={{ margin: 0 }}>Stored rounded to ~1 km. Never shared with requesters. Updated only when you choose.</p>
        </>
      )}
    </section>
  );
}
