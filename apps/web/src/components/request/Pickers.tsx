"use client";
import { BLOOD_GROUPS, type BloodComponent, type BloodGroup } from "@raktdoot/shared";
import { COMPONENT_HINT, COMPONENT_LABEL } from "../../lib/format.ts";

export function BloodGroupPicker({ value, onChange }: { value: BloodGroup | null; onChange: (g: BloodGroup) => void }) {
  return (
    <div className="pills" role="group" aria-label="Blood group">
      {BLOOD_GROUPS.map((g) => (
        <button key={g} type="button" className="pill" aria-pressed={value === g} onClick={() => onChange(g)}>{g}</button>
      ))}
    </div>
  );
}

export const REQUESTABLE_COMPONENTS = ["PACKED_RED_CELLS", "PLATELETS", "PLASMA", "WHOLE_BLOOD"] as const;
export type RequestableComponent = (typeof REQUESTABLE_COMPONENTS)[number];

export function ComponentPicker({ value, onChange }: { value: RequestableComponent | null; onChange: (c: RequestableComponent) => void }) {
  return (
    <div className="grid-2" role="group" aria-label="Component">
      {REQUESTABLE_COMPONENTS.map((c) => (
        <button key={c} type="button" className="pill pill-wide" aria-pressed={value === c} onClick={() => onChange(c)}
          style={{ height: "auto", padding: "12px 14px", textAlign: "left" }}>
          <span style={{ display: "block" }}>{COMPONENT_LABEL[c as BloodComponent]}</span>
          <span className="tiny muted" style={{ fontWeight: 500 }}>{COMPONENT_HINT[c as BloodComponent]}</span>
        </button>
      ))}
    </div>
  );
}

export function UnitsStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(100, Math.max(1, n)));
  return (
    <div className="stepper" role="group" aria-label="Units">
      <button type="button" onClick={() => set(value - 1)} aria-label="Fewer units">−</button>
      <div className="val" aria-live="polite">{value} <span className="small muted" style={{ fontWeight: 600 }}>unit{value === 1 ? "" : "s"}</span></div>
      <button type="button" onClick={() => set(value + 1)} aria-label="More units">+</button>
    </div>
  );
}

const QUICK = [
  { label: "In 6 hours", hours: 6 },
  { label: "Tonight", hours: -1 },
  { label: "Tomorrow 9 AM", hours: -2 },
  { label: "In 2 days", hours: 48 },
];

function quickIso(hours: number): string {
  const d = new Date();
  if (hours === -1) { d.setHours(21, 0, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); }
  else if (hours === -2) { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  else { d.setTime(Date.now() + hours * 3_600_000); d.setSeconds(0, 0); }
  return d.toISOString();
}

export function NeededByPicker({ value, onChange }: { value: string | null; onChange: (iso: string) => void }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row wrap" style={{ gap: 6 }}>
        {QUICK.map((q) => (
          <button key={q.label} type="button" className="chip" style={{ cursor: "pointer", height: 34 }} onClick={() => onChange(quickIso(q.hours))}>{q.label}</button>
        ))}
      </div>
      <input type="datetime-local" className="input" aria-label="Needed by"
        value={value ? toLocal(value) : ""} min={toLocal(new Date(Date.now() + 5 * 60_000).toISOString())}
        onChange={(e) => { const d = new Date(e.target.value); if (!Number.isNaN(d.getTime())) onChange(d.toISOString()); }} />
    </div>
  );
}

function toLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
