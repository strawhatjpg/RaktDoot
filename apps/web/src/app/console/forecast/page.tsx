"use client";
// Forecast: per group/component P10–P90 band vs expected supply + backtest vs seasonal-naive baseline.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ForecastResponse } from "@raktdoot/shared";
import { BacktestLines, ForecastBand, RiskBar } from "../../../components/console/Charts.tsx";
import { useDistrict } from "../../../components/console/useDistrict.ts";
import { Chip, ErrorCard, Skeleton } from "../../../components/Ui.tsx";
import { api, forecastErrorMessage } from "../../../lib/api.ts";
import { COMPONENT_LABEL } from "../../../lib/format.ts";
import type { Backtest } from "../../../lib/types.ts";

export default function ForecastPage() {
  const district = useDistrict();
  const [fc, setFc] = useState<ForecastResponse | null>(null);
  const [bt, setBt] = useState<Backtest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<string>("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [f, b] = await Promise.all([api.forecast(district, 4), api.backtest(district)]);
      setFc(f); setBt(b);
    } catch (e) { setError(forecastErrorMessage(e)); }
  }, [district]);
  useEffect(() => { void load(); }, [load]);

  // Series = bloodGroup|component, ranked by peak shortage risk.
  const ranked = useMemo(() => {
    if (!fc) return [];
    const map = new Map<string, ForecastResponse["points"]>();
    for (const p of fc.points) {
      const k = `${p.bloodGroup}|${p.component}`;
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.entries()]
      .map(([k, pts]) => ({ k, pts: pts.sort((a, b) => a.weekStart.localeCompare(b.weekStart)), risk: Math.max(...pts.map((p) => p.shortageRisk)), demand: pts.reduce((s, p) => s + p.p50, 0) }))
      .filter((s) => s.demand >= 4)
      .sort((a, b) => b.risk - a.risk);
  }, [fc]);

  useEffect(() => { if (ranked.length && !ranked.some((r) => r.k === series)) setSeries(ranked[0]!.k); }, [ranked, series]);
  const active = ranked.find((r) => r.k === series);
  const [g, c] = series.split("|");

  return (
    <div className="stack fade-up" style={{ gap: 20 }}>
      <div className="row between wrap" style={{ gap: 12 }}>
        <div><span className="eyebrow">Demand forecast · 4 weeks</span><h1 className="h2" style={{ marginTop: 6 }}>{district}</h1></div>
        {fc?.isSynthetic && <Chip tone="amber">synthetic data · not for clinical decisions</Chip>}
      </div>
      {error && <ErrorCard message={error} onRetry={() => void load()} />}
      {!fc && !error && <><Skeleton h={300} /><Skeleton h={220} /></>}

      {fc && active && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: 16 }} className="fc-grid">
          <section className="glass card-lg stack" style={{ gap: 12 }}>
            <div className="row between wrap" style={{ gap: 8 }}>
              <h2 className="h3">{g} · {COMPONENT_LABEL[c as keyof typeof COMPONENT_LABEL] ?? c}</h2>
              <div className="row tiny muted" style={{ gap: 14 }}>
                <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 3, background: "#ff4d6d", borderRadius: 2 }} />median</span>
                <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 10, background: "rgba(255,77,109,.3)", borderRadius: 2 }} />P10–P90</span>
                <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed #2dd4bf" }} />supply</span>
              </div>
            </div>
            <ForecastBand points={active.pts} />
            <div className="stack" style={{ gap: 6 }}>
              {active.pts[0]?.drivers.slice(0, 3).map((d) => <span key={d} className="tiny muted">• {d}</span>)}
            </div>
          </section>
          <section className="glass card stack" style={{ gap: 6, maxHeight: 460, overflowY: "auto" }}>
            <strong className="small" style={{ marginBottom: 6 }}>Series by peak risk</strong>
            {ranked.map((r) => {
              const [rg, rc] = r.k.split("|");
              return (
                <button key={r.k} onClick={() => setSeries(r.k)} className="stack" style={{ gap: 6, textAlign: "left", padding: 10, borderRadius: 12, cursor: "pointer", border: "1px solid", borderColor: r.k === series ? "rgba(255,77,109,.4)" : "transparent", background: r.k === series ? "rgba(225,29,72,.1)" : "transparent" }}>
                  <span className="small"><strong>{rg}</strong> <span className="muted">{COMPONENT_LABEL[rc as keyof typeof COMPONENT_LABEL] ?? rc}</span></span>
                  <RiskBar value={r.risk} />
                </button>
              );
            })}
          </section>
        </div>
      )}

      {bt && (
        <section className="glass card-lg stack" style={{ gap: 12 }}>
          <div className="row between wrap" style={{ gap: 8 }}>
            <h2 className="h3">Backtest: model vs seasonal-naive baseline</h2>
            <div className="row" style={{ gap: 8 }}>
              <Chip tone="green">MAE {bt.modelMae} vs {bt.baselineMae}</Chip>
              <Chip tone="teal">P10–P90 coverage {Math.round(bt.intervalCoverage * 100)}%</Chip>
              <Chip>{bt.weeksTested} weeks</Chip>
            </div>
          </div>
          <BacktestLines weekly={bt.weekly} />
          <span className="tiny faint">Rolling-origin backtest. Lower is better. Red is the gradient-boosting quantile model; dashed grey is the seasonal-naive baseline.</span>
        </section>
      )}
      <style>{`@media (max-width: 1000px) { .fc-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
