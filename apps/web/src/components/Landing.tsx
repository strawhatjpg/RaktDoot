// Landing page sections (server components; CSS-only animation).
import { Drop } from "./Drop.tsx";

export function HeroDrop() {
  return (
    <div className="hero-drop" aria-hidden>
      <span className="ring" /><span className="ring" /><span className="ring" />
      <div style={{ position: "absolute", inset: "8%", borderRadius: "50%", background: "radial-gradient(circle at 50% 55%, rgba(225,29,72,.35), transparent 65%)" }} />
      <Drop ecg size={300} />
      <div className="glass" style={{ position: "absolute", left: 0, bottom: "14%", padding: "12px 14px", borderRadius: 16, minWidth: 190 }}>
        <div className="tiny faint">Nearest centre</div>
        <div style={{ fontWeight: 800 }}>1.2 km · B+ PRBC</div>
        <div className="tiny" style={{ color: "var(--green)" }}>● updated 12 min ago</div>
      </div>
      <div className="glass" style={{ position: "absolute", right: 0, top: "16%", padding: "12px 14px", borderRadius: 16, minWidth: 170 }}>
        <div className="tiny faint">WhatsApp wave 1</div>
        <div style={{ fontWeight: 800 }}>5 donors alerted</div>
        <div className="tiny" style={{ color: "var(--gold)" }}>2 accepted · ETA 18 min</div>
      </div>
    </div>
  );
}

const STATS = [
  { n: "1.46 Cr", l: "units of blood India needs every year", c: "var(--red-2)" },
  { n: "17.4 L", l: "components discarded in 2025, mostly expired", c: "var(--gold)" },
  { n: "~10%", l: "of districts have no functional blood centre", c: "var(--red-2)" },
  { n: "39%", l: "in 8 northern states can't reach blood within an hour", c: "var(--gold)" },
];

export function Stats() {
  return (
    <section className="container" style={{ padding: "20px 20px 50px" }}>
      <div className="grid-4">
        {STATS.map((s) => (
          <div key={s.n} className="glass card hover-lift">
            <div className="stat-num" style={{ color: s.c }}>{s.n}</div>
            <p className="muted small" style={{ margin: "10px 0 0" }}>{s.l}</p>
          </div>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: 10 }}>Sources: Govt. of India in Parliament (2025), Rajya Sabha data (2026), MoHFW review (2026), BMJ Global Health (2024).</p>
    </section>
  );
}

const STEPS = [
  { i: "📱", t: "Request in the app", d: "Tap, type or speak in your language. AI fills the form; you confirm." },
  { i: "📍", t: "Centres instantly", d: "Nearby licensed centres with stock labelled and time-stamped." },
  { i: "✅", t: "Verified", d: "Hospital or coordinator confirms before any donor is contacted." },
  { i: "💬", t: "WhatsApp waves", d: "Top-ranked donors alerted in small batches, then a stand-down." },
  { i: "🩸", t: "Closed loop", d: "The centre confirms the donation; staff close the case." },
];

export function HowItWorks() {
  return (
    <section className="container" style={{ padding: "30px 20px 50px" }}>
      <div className="stack" style={{ gap: 8, marginBottom: 22 }}>
        <span className="eyebrow">How it works</span>
        <h2 className="h2">From one request to a confirmed donation</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        {STEPS.map((s, i) => (
          <div key={s.t} className="glass card hover-lift stack" style={{ gap: 10 }}>
            <div className="row between">
              <span style={{ fontSize: 28 }}>{s.i}</span>
              <span className="mono tiny faint">0{i + 1}</span>
            </div>
            <strong>{s.t}</strong>
            <span className="muted small">{s.d}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  { t: "Multilingual AI intake", d: "Hindi, English, Hinglish and Marathi. \"B+ve\" or \"बी पॉजिटिव\" becomes B+. You always confirm before anything opens.", tone: "var(--red-2)" },
  { t: "Verification gate", d: "Anyone can request instantly, but private donors are contacted only after hospital or coordinator verification.", tone: "var(--teal)" },
  { t: "Explainable matching", d: "Donors ranked by freshness, distance and alert load, with reasons shown to the coordinator.", tone: "var(--gold)" },
  { t: "Privacy by design", d: "Consent for each purpose, location stored at ~1 km, phone numbers never shown to requesters.", tone: "var(--violet)" },
  { t: "Shortage forecasting", d: "Weekly demand ranges per blood group and component, backtested against a seasonal baseline.", tone: "var(--green)" },
  { t: "Coordinator Copilot", d: "Built on the Cline SDK. Briefs coordinators and drafts outreach. A person approves every action.", tone: "var(--red-2)" },
];

export function Features() {
  return (
    <section className="container" style={{ padding: "30px 20px 50px" }}>
      <div className="stack" style={{ gap: 8, marginBottom: 22 }}>
        <span className="eyebrow">Why RaktDoot</span>
        <h2 className="h2">Built for trust, speed and dignity</h2>
      </div>
      <div className="grid-3">
        {FEATURES.map((f) => (
          <div key={f.t} className="glass card hover-lift stack" style={{ gap: 10 }}>
            <span style={{ width: 36, height: 4, borderRadius: 4, background: f.tone }} />
            <strong style={{ fontSize: 17 }}>{f.t}</strong>
            <span className="muted small" style={{ lineHeight: 1.55 }}>{f.d}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
