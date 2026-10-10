"use client";
// Small presentational building blocks shared by the app and the console.
import Link from "next/link";
import type { ReactNode } from "react";
import { IconBack } from "./icons.tsx";

export function Chip({ tone = "", children, live = false }: { tone?: "red" | "green" | "amber" | "teal" | "violet" | ""; children: ReactNode; live?: boolean }) {
  return (
    <span className={`chip${tone ? ` chip-${tone}` : ""}`}>
      {live && <span className="dot dot-live" />}
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: string; action?: ReactNode }) {
  return (
    <header className="row between" style={{ alignItems: "flex-start", marginBottom: 6 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        {back && <Link href={back} className="icon-btn" aria-label="Back"><IconBack width={18} /></Link>}
        <div>
          <h1 className="h3" style={{ fontSize: 24 }}>{title}</h1>
          {subtitle && <p className="muted small" style={{ margin: "4px 0 0" }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

export function Skeleton({ h = 72, style }: { h?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height: h, ...style }} />;
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="glass empty stack" style={{ alignItems: "center" }}>
      <div style={{ fontSize: 34 }}>{icon}</div>
      <h3 className="h3">{title}</h3>
      <p className="muted small" style={{ margin: 0, maxWidth: 320 }}>{text}</p>
      {action}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass card stack" role="alert" style={{ borderColor: "rgba(255,77,109,.35)" }}>
      <strong>Something went wrong</strong>
      <span className="muted small">{message}</span>
      {onRetry && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="track" />
    </label>
  );
}

export function SimulatedNote() {
  return (
    <div className="banner" role="note">
      <strong>Demo data.</strong> Hospitals, blood centres and stock shown here are fictional and simulated. In an emergency, follow your treating hospital&apos;s guidance.
    </div>
  );
}
