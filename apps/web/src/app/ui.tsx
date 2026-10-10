"use client";
// Small shared UI kit (no CSS framework in this repo). Mobile-first, accessible.
import type { CSSProperties, ReactNode } from "react";

export const C = { red: "#b3121f", redDark: "#8a0d17", ink: "#1d1d1f", muted: "#5f6368", line: "#e3e3e3", bg: "#fafafa", ok: "#1e7d32", warn: "#9a5b00" };

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <header style={{ background: C.red, color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 18 }}>🩸 RaktDoot</a>
        <nav style={{ display: "flex", gap: 14, fontSize: 14, flexWrap: "wrap" }}>
          <a href="/request" style={nav}>Need blood</a>
          <a href="/donor" style={nav}>Donate</a>
          <a href="/rewards" style={nav}>Rewards</a>
          <a href="/dashboard" style={nav}>Staff</a>
          <a href="/demo" style={nav}>WhatsApp inbox</a>
        </nav>
      </header>
      <main style={{ maxWidth: wide ? 1100 : 640, margin: "0 auto", padding: 16 }}>{children}</main>
      <footer style={{ maxWidth: 640, margin: "24px auto", padding: "0 16px 24px", fontSize: 12, color: C.muted }}>
        Not an emergency service — follow your treating hospital&apos;s guidance. Donors give only at licensed blood centres, where staff confirm eligibility. Demo data is fictional.
      </footer>
    </div>
  );
}
const nav: CSSProperties = { color: "#fff", opacity: 0.92 };

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <section style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, margin: "12px 0", ...style }}>{children}</section>;
}

export function Button({ children, onClick, kind = "primary", disabled, type = "button" }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "secondary" | "ghost"; disabled?: boolean; type?: "button" | "submit" }) {
  const styles: Record<string, CSSProperties> = {
    primary: { background: C.red, color: "#fff", border: "none" },
    secondary: { background: "#fff", color: C.red, border: `1px solid ${C.red}` },
    ghost: { background: "transparent", color: C.muted, border: `1px solid ${C.line}` },
  };
  return <button type={type} onClick={onClick} disabled={disabled} style={{ ...styles[kind], padding: "10px 16px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, marginRight: 8, marginTop: 8 }}>{children}</button>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label style={{ display: "block", margin: "12px 0" }}>
      <span style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}
export const input: CSSProperties = { width: "100%", padding: "10px 12px", fontSize: 15, border: `1px solid ${C.line}`, borderRadius: 8, boxSizing: "border-box", background: "#fff" };

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "warn" | "red" }) {
  const color = { muted: C.muted, ok: C.ok, warn: C.warn, red: C.red }[tone];
  return <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color, border: `1px solid ${color}`, borderRadius: 999, padding: "2px 8px", marginRight: 6 }}>{children}</span>;
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <p role="alert" style={{ color: C.red, fontWeight: 600 }}>{error}</p> : null;
}

/** fetch JSON with same-origin cookies; throws the API's error message. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET", credentials: "same-origin",
    headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

export interface Me { signedIn: boolean; user?: { id: string; name: string; role: string; verifiedStaff: boolean; hasPhone: boolean; email: string | null; isDonor: boolean }; methods: { google: boolean; whatsapp: boolean; demo: boolean; rewards?: boolean; botNumber?: string | null } }

export const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const COMPONENTS: Array<[string, string]> = [["PACKED_RED_CELLS", "Packed red cells"], ["PLATELETS", "Platelets"], ["WHOLE_BLOOD", "Whole blood"], ["PLASMA", "Plasma"]];
export const label = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());