"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Card, ErrorText, Shell, C, api } from "../ui.tsx";
import { useMe } from "../useMe.ts";

export default function Login() {
  const { me } = useMe();
  const [error, setError] = useState<string | null>(null);
  const [wa, setWa] = useState<{ code: string; link: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const returnTo = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("returnTo") ?? "/" : "/";

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setError(e === "not_configured" ? "Google sign-in is not configured on this server." : "Google sign-in was cancelled or failed. Please try again.");
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);
  useEffect(() => { if (me?.signedIn) window.location.href = returnTo; }, [me, returnTo]);

  const startWhatsApp = async () => {
    setError(null);
    try {
      const started = await api<{ code: string; link: string }>("/api/auth/whatsapp/start", { method: "POST" });
      setWa(started);
      window.open(started.link, "_blank", "noopener");
      timer.current = setInterval(async () => {
        try {
          const r = await api<{ status: string }>("/api/auth/whatsapp/poll", { method: "POST", body: { code: started.code } });
          if (r.status === "confirmed") { clearInterval(timer.current!); window.location.href = returnTo; }
          if (r.status === "expired") { clearInterval(timer.current!); setWa(null); setError("Code expired. Please try again."); }
        } catch (e) { clearInterval(timer.current!); setError((e as Error).message); }
      }, 2000);
    } catch (e) { setError((e as Error).message); }
  };

  const demo = async (userId: string) => {
    try { await api("/api/auth/demo", { method: "POST", body: { userId } }); window.location.href = userId === "demo-requester" ? "/request" : "/dashboard"; }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <Shell>
      <h1>Sign in</h1>
      <ErrorText error={error} />
      <Card>
        <a href={`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`} aria-disabled={!me?.methods.google}>
          <Button disabled={me ? !me.methods.google : true}>Continue with Google</Button>
        </a>
        {me && !me.methods.google && <p style={{ fontSize: 13, color: C.muted }}>Google sign-in needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.</p>}
        <div style={{ marginTop: 12 }}>
          <Button kind="secondary" onClick={startWhatsApp} disabled={me ? !me.methods.whatsapp : true}>Log in with WhatsApp</Button>
          {wa && <p style={{ fontSize: 14 }}>Send <strong>LOGIN {wa.code}</strong> to our WhatsApp number (opened in a new tab). Waiting…</p>}
        </div>
      </Card>
      {me?.methods.demo && (
        <Card>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Demo accounts (fictional, development only)</h2>
          <Button kind="ghost" onClick={() => demo("demo-requester")}>Family member</Button>
          <Button kind="ghost" onClick={() => demo("demo-coordinator")}>Coordinator (Pune)</Button>
          <Button kind="ghost" onClick={() => demo("demo-hospital-staff")}>Hospital staff</Button>
        </Card>
      )}
    </Shell>
  );
}