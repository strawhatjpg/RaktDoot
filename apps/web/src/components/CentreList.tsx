"use client";
// Blood-centre-first discovery (M2 /api/centres). Stock is always labelled with status, age and "simulated".
import { useEffect, useState } from "react";
import type { CentreResultDTO } from "@raktdoot/shared";
import { api, ApiFailure } from "../lib/api.ts";
import { timeAgo } from "../lib/format.ts";
import { IconClock, IconPhone, IconPin } from "./icons.tsx";
import { Chip, ErrorCard, Skeleton } from "./Ui.tsx";

const STOCK_TONE = { CONFIRMED: "green", REPORTED: "amber", RESERVED: "violet" } as const;

export function CentreList({ hospitalId, bloodGroup, component, limit }: { hospitalId: string; bloodGroup: string; component: string; limit?: number }) {
  const [centres, setCentres] = useState<CentreResultDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    setCentres(null); setError(null);
    api.centres(hospitalId, bloodGroup, component)
      .then((r) => { if (alive) setCentres(r.centres); })
      .catch((e) => { if (alive) setError(e instanceof ApiFailure ? e.message : "Could not load centres"); });
    return () => { alive = false; };
  }, [hospitalId, bloodGroup, component, tick]);

  if (error) return <ErrorCard message={error} onRetry={() => setTick((t) => t + 1)} />;
  if (!centres) return <div className="stack"><Skeleton h={96} /><Skeleton h={96} /><Skeleton h={96} /></div>;
  if (centres.length === 0) return <div className="glass card muted small">No licensed blood centres listed in this district yet.</div>;

  const sorted = [...centres].sort((a, b) => (b.stock?.units ? 1 : 0) - (a.stock?.units ? 1 : 0) || a.distanceKm - b.distanceKm);
  const shown = expanded ? sorted : sorted.slice(0, limit ?? 5);
  return (
    <div className="stack" style={{ gap: 10 }}>
      {shown.map((c, i) => {
        const has = (c.stock?.units ?? 0) > 0;
        return (
          <article key={c.centreId} className="glass card hover-lift stack fade-up" style={{ gap: 10, animationDelay: `${i * 40}ms`, borderColor: i === 0 && has ? "rgba(52,211,153,.35)" : undefined }}>
            <div className="row between" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 750 }}>{c.name}</div>
                <div className="row tiny muted" style={{ gap: 10, marginTop: 4 }}>
                  <span className="row" style={{ gap: 4 }}><IconPin width={13} />{c.distanceKm} km</span>
                  {c.stock && <span className="row" style={{ gap: 4 }}><IconClock width={13} />updated {timeAgo(c.stock.updatedAt)}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 850, color: has ? "var(--green)" : "var(--faint)" }}>{c.stock ? c.stock.units : "—"}</div>
                <div className="tiny faint">units</div>
              </div>
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              {c.stock ? <Chip tone={STOCK_TONE[c.stock.status]}>{c.stock.status.toLowerCase()}</Chip> : <Chip>no stock report</Chip>}
              {(c.isSimulated || c.stock?.isSimulated) && <Chip>simulated</Chip>}
              {i === 0 && has && <Chip tone="green">best match</Chip>}
            </div>
            {c.phone ? (
              <a href={`tel:${c.phone}`} className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}><IconPhone width={15} /> Call centre</a>
            ) : (
              <span className="tiny faint">No public phone listed. Ask your hospital&apos;s blood bank to coordinate.</span>
            )}
          </article>
        );
      })}
      {shown.length < sorted.length && (
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: "center" }} onClick={() => setExpanded(true)}>
          Show all {sorted.length} centres
        </button>
      )}
      <p className="tiny faint" style={{ margin: 0 }}>Distances are straight-line. Stock is self-reported by centres and may change. Always call before travelling.</p>
    </div>
  );
}
