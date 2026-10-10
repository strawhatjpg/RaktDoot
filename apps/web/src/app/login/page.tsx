"use client";
// "Log in with WhatsApp" (M1's code flow, M2's sessions), Google (M2, when configured)
// and demo accounts in DEMO_MODE.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DemoAccounts } from "../../components/DemoAccounts.tsx";
import { Brand, Drop } from "../../components/Drop.tsx";
import { IconArrow, IconWhatsApp } from "../../components/icons.tsx";
import { useSession } from "../../components/Session.tsx";
import { useToast } from "../../components/Toast.tsx";
import { api, ApiFailure, isStaff } from "../../lib/api.ts";

type Code = { code: string; link: string | null; expiresAt: string; botConfigured: boolean };

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { me, refresh } = useSession();
  const [code, setCode] = useState<Code | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const poller = useRef<ReturnType<typeof setInterval> | null>(null);
  // M4 pages use ?next=, M2's pages (/r/<code>, /dashboard, /rewards) use ?returnTo=.
  const next = params.get("next") ?? params.get("returnTo");

  const goNext = useCallback(async () => {
    const user = await refresh();
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    router.replace(safeNext ?? (isStaff(user) ? "/console" : "/home"));
  }, [next, refresh, router]);

  useEffect(() => { if (me) void goNext(); }, [me, goNext]);
  useEffect(() => () => { if (poller.current) clearInterval(poller.current); }, []);
  useEffect(() => { api.signInMethods().then((m) => setGoogle(m.google)).catch(() => setGoogle(false)); }, []);
  useEffect(() => {
    const err = params.get("error");
    if (err) toast(err === "not_configured" ? "Google sign-in is not configured on this server" : "Google sign-in did not complete. Please try again.", { error: true });
  }, [params, toast]);
  const googleHref = `/api/auth/google/start?returnTo=${encodeURIComponent(next && next.startsWith("/") && !next.startsWith("//") ? next : "/home")}`;

  async function startWhatsApp() {
    setBusy(true);
    try {
      const c = await api.waStart();
      setCode(c);
      setExpired(false);
      if (poller.current) clearInterval(poller.current);
      poller.current = setInterval(async () => {
        try {
          const r = await api.waPoll(c.code);
          if (r.status === "pending") return;
          if (poller.current) clearInterval(poller.current);
          if (r.status === "confirmed") { toast("Signed in with WhatsApp"); await goNext(); }
          else setExpired(true);
        } catch { /* transient: keep polling */ }
      }, 2000);
    } catch (e) {
      toast(e instanceof ApiFailure ? e.message : "Could not start sign-in", { error: true });
    } finally { setBusy(false); }
  }

  return (
    <main className="app-shell" style={{ paddingTop: 28, paddingBottom: 60 }}>
      <div className="row between" style={{ marginBottom: 28 }}>
        <Link href="/"><Brand /></Link>
        <Link href="/simulator" className="small muted">WhatsApp demo →</Link>
      </div>

      <div className="stack fade-up" style={{ gap: 18 }}>
        <div className="stack" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
          <Drop size={64} ecg />
          <h1 className="h2">Welcome to RaktDoot</h1>
          <p className="muted" style={{ margin: 0 }}>No passwords. Your WhatsApp number is your identity.</p>
        </div>

        <section className="glass card-lg stack glow" style={{ gap: 16 }}>
          {!code || expired ? (
            <>
              <button className="btn btn-wa btn-block" onClick={() => void startWhatsApp()} disabled={busy}>
                <IconWhatsApp width={20} /> {expired ? "Code expired, get a new one" : "Log in with WhatsApp"}
              </button>
              <p className="tiny faint" style={{ margin: 0, textAlign: "center" }}>We show a 6-digit code. Send it to the RaktDoot bot on WhatsApp and you&apos;re in.</p>
            </>
          ) : (
            <div className="stack" style={{ alignItems: "center", textAlign: "center", gap: 14 }}>
              <span className="chip chip-teal"><span className="dot dot-live" /> Waiting for your WhatsApp message</span>
              <div className="mono" style={{ fontSize: 40, fontWeight: 800, letterSpacing: "0.25em" }}>{code.code}</div>
              <p className="muted small" style={{ margin: 0 }}>Send <span className="kbd">LOGIN {code.code}</span> to the RaktDoot bot. Single use, expires in 5 minutes.</p>
              {code.link ? (
                <a href={code.link} target="_blank" rel="noreferrer" className="btn btn-wa btn-block"><IconWhatsApp width={20} /> Open WhatsApp</a>
              ) : (
                <Link href={`/simulator?text=${encodeURIComponent(`LOGIN ${code.code}`)}`} target="_blank" className="btn btn-ghost btn-block">
                  Send it from the WhatsApp simulator <IconArrow width={16} />
                </Link>
              )}
              {!code.botConfigured && <p className="tiny faint" style={{ margin: 0 }}>No WhatsApp number is configured on this server, so use the simulator. It runs the same bot.</p>}
            </div>
          )}
          {google && (!code || expired) && (
            <a href={googleHref} className="btn btn-ghost btn-block">Continue with Google</a>
          )}
        </section>

        <DemoAccounts onSignedIn={goNext} />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}
