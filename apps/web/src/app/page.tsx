import Link from "next/link";
import { Brand } from "../components/Drop.tsx";
import { HeroDrop, Features, HowItWorks, Stats } from "../components/Landing.tsx";
import { IconArrow, IconWhatsApp } from "../components/icons.tsx";

export default function Landing() {
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <Brand />
          <div className="row" style={{ gap: 8 }}>
            <Link href="/simulator" className="btn btn-ghost btn-sm">WhatsApp demo</Link>
            <Link href="/login" className="btn btn-primary btn-sm">Sign in</Link>
          </div>
        </div>
      </div>

      <main>
        <section className="container" style={{ padding: "64px 20px 40px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 40, alignItems: "center" }}>
            <div className="stack fade-up" style={{ gap: 22 }}>
              <span className="chip chip-red" style={{ alignSelf: "flex-start" }}><span className="dot dot-live" /> Blood access coordination for India</span>
              <h1 className="h1">Right blood.<br /><span className="grad-text">Right place.</span><br />Right time.</h1>
              <p className="lead" style={{ maxWidth: 520 }}>
                Families request blood in seconds, in their own language. RaktDoot shows nearby licensed blood centres instantly and,
                once a request is verified, alerts matched donors on WhatsApp.
              </p>
              <div className="row wrap" style={{ gap: 12 }}>
                <Link href="/request/new" className="btn btn-primary">Request blood now <IconArrow width={18} /></Link>
                <Link href="/donor" className="btn btn-ghost">Become a donor</Link>
              </div>
              <div className="row wrap small muted" style={{ gap: 18 }}>
                <span>🌐 Hindi · English · Hinglish · मराठी</span>
                <span className="row" style={{ gap: 6 }}><IconWhatsApp width={16} style={{ color: "#25d366" }} /> Donors on WhatsApp</span>
              </div>
            </div>
            <HeroDrop />
          </div>
        </section>

        <Stats />
        <HowItWorks />
        <Features />

        <section className="container" style={{ padding: "40px 20px 90px" }}>
          <div className="glass card-lg glow stack" style={{ alignItems: "center", textAlign: "center", gap: 18, background: "linear-gradient(135deg, rgba(225,29,72,.22), rgba(127,13,36,.18))" }}>
            <h2 className="h2">Every drop collected should reach a patient in time.</h2>
            <p className="lead" style={{ maxWidth: 640 }}>Partner with us: blood centres, hospitals, NGOs and state councils.</p>
            <div className="row wrap" style={{ gap: 12, justifyContent: "center" }}>
              <Link href="/login" className="btn btn-primary">Open the app</Link>
              <Link href="/console" className="btn btn-ghost">Staff console</Link>
            </div>
          </div>
          <p className="tiny faint" style={{ textAlign: "center", marginTop: 26 }}>
            Prototype for the Cline AI Builder Hackathon. All hospitals, centres, donors and stock are fictional demo data. Not an emergency service; always follow your treating hospital&apos;s guidance.
          </p>
        </section>
      </main>
    </>
  );
}