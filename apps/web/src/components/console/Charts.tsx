"use client";
// Dependency-free SVG charts for the console.
import type { ForecastPoint } from "@raktdoot/shared";

/** P10–P90 band + P50 line + expected-supply dashed line for one series over weeks. */
export function ForecastBand({ points, height = 220 }: { points: ForecastPoint[]; height?: number }) {
  if (points.length === 0) return <div className="muted small">No data</div>;
  const W = 640, H = height, pad = { l: 40, r: 16, t: 16, b: 30 };
  const max = Math.max(...points.map((p) => Math.max(p.p90, p.expectedSupply))) * 1.12 || 1;
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const band = points.map((p, i) => `${x(i)},${y(p.p90)}`).join(" ") + " " + [...points].reverse().map((p, i) => `${x(points.length - 1 - i)},${y(p.p10)}`).join(" ");
  const line = (k: "p50" | "expectedSupply") => points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[k])}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Demand forecast with P10 to P90 range and expected supply">
      <defs>
        <linearGradient id="fb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff4d6d" stopOpacity=".45" /><stop offset="1" stopColor="#e11d48" stopOpacity=".08" /></linearGradient>
      </defs>
      {ticks.map((t) => <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.06)" /><text x={pad.l - 8} y={y(t) + 4} fill="#7d6670" fontSize="11" textAnchor="end">{t}</text></g>)}
      <polygon points={band} fill="url(#fb)" />
      <path d={line("expectedSupply")} fill="none" stroke="#2dd4bf" strokeWidth="2" strokeDasharray="6 5" />
      <path d={line("p50")} fill="none" stroke="#ff4d6d" strokeWidth="3" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.weekStart}>
          <circle cx={x(i)} cy={y(p.p50)} r="4.5" fill="#ff4d6d" stroke="#0b0507" strokeWidth="2" />
          <text x={x(i)} y={H - 8} fill="#b39ca2" fontSize="11" textAnchor="middle">{p.weekStart.slice(5)}</text>
        </g>
      ))}
    </svg>
  );
}

/** Two-line comparison (model vs baseline MAE per backtest week). */
export function BacktestLines({ weekly, height = 200 }: { weekly: Array<{ weekStart: string; modelMae: number; baselineMae: number }>; height?: number }) {
  if (weekly.length < 2) return <div className="muted small">Not enough backtest weeks</div>;
  // Wide viewBox: this chart spans a full-width card, so a narrow one would scale the labels up.
  const W = 1100, H = height, pad = { l: 40, r: 24, t: 12, b: 26 };
  const max = Math.max(...weekly.map((w) => Math.max(w.modelMae, w.baselineMae))) * 1.1 || 1;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (weekly.length - 1);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const path = (k: "modelMae" | "baselineMae") => weekly.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(w[k]).toFixed(1)}`).join(" ");
  const area = `${path("modelMae")} L${x(weekly.length - 1)},${H - pad.b} L${pad.l},${H - pad.b} Z`;
  const step = Math.ceil(weekly.length / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Backtest error: model versus baseline">
      <defs><linearGradient id="bt" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff4d6d" stopOpacity=".3" /><stop offset="1" stopColor="#ff4d6d" stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((f) => <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,.06)" />)}
      <path d={area} fill="url(#bt)" />
      <path d={path("baselineMae")} fill="none" stroke="#7d6670" strokeWidth="2" strokeDasharray="5 5" />
      <path d={path("modelMae")} fill="none" stroke="#ff4d6d" strokeWidth="2.5" />
      {weekly.map((w, i) => i % step === 0 && <text key={w.weekStart} x={x(i)} y={H - 6} fill="#7d6670" fontSize="12" textAnchor="middle">{w.weekStart.slice(5)}</text>)}
    </svg>
  );
}

export function RiskBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? "linear-gradient(90deg, #ff4d6d, #e11d48)" : value >= 0.4 ? "linear-gradient(90deg, #fbbf24, #f4a259)" : "linear-gradient(90deg, #34d399, #2dd4bf)";
  return (
    <div className="row" style={{ gap: 10 }}>
      <div className="bar" style={{ flex: 1 }}><span style={{ width: `${pct}%`, background: color }} /></div>
      <strong className="small" style={{ width: 38, textAlign: "right" }}>{pct}%</strong>
    </div>
  );
}
