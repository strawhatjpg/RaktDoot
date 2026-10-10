"use client";
// Case journey timeline driven by M2's RequestEventDTO list.
import type { BloodRequestDetailDTO } from "@raktdoot/shared";
import { JOURNEY, formatWhen, statusRank } from "../lib/format.ts";

export function Journey({ data }: { data: BloodRequestDetailDTO }) {
  const rank = statusRank(data.request.status);
  const currentIdx = JOURNEY.reduce((acc, step, i) => (rank >= statusRank(step.status) ? i : acc), 0);
  return (
    <section className="glass card stack" style={{ gap: 6 }}>
      <h2 className="h3" style={{ fontSize: 17, marginBottom: 10 }}>Journey</h2>
      <div className="timeline">
        {JOURNEY.map((step, i) => {
          const done = rank >= statusRank(step.status);
          const ev = data.events.find((e) => e.toStatus === step.status);
          return (
            <div key={step.status} className={`tl-item${done ? " done" : ""}${i === currentIdx + 1 ? " current" : ""}`}>
              <div className="tl-dot">{done ? "✓" : step.icon}</div>
              <div style={{ paddingTop: 5 }}>
                <div style={{ fontWeight: 700, color: done ? "var(--text)" : "var(--muted)" }}>{step.title}</div>
                <div className="tiny muted">{ev ? formatWhen(ev.createdAt) : step.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
