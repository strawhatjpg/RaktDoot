"use client";
import { Button, Card, Shell, C, api } from "./ui.tsx";
import { useMe } from "./useMe.ts";

export default function Home() {
  const { me, refresh } = useMe();
  const signOut = async () => { await api("/api/auth/session", { method: "DELETE" }).catch(() => undefined); refresh(); };
  return (
    <Shell>
      <h1 style={{ fontSize: 28, margin: "16px 0 4px" }}>From blood request to confirmed response</h1>
      <p style={{ color: C.muted, marginTop: 0 }}>Find nearby blood centres instantly. Verified requests alert nearby donors on WhatsApp — they tap Accept or Ignore.</p>
      {me?.signedIn ? (
        <Card>
          <p style={{ margin: 0 }}>Signed in as <strong>{me.user?.name}</strong>{me.user?.email ? ` (${me.user.email})` : ""} · {me.user?.role.replaceAll("_", " ").toLowerCase()}</p>
          <Button kind="ghost" onClick={signOut}>Sign out</Button>
        </Card>
      ) : (
        <Card><a href="/login"><Button>Sign in</Button></a></Card>
      )}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <a href="/request" style={{ textDecoration: "none", color: "inherit" }}><Card style={{ margin: 0, borderColor: C.red }}><h2 style={{ margin: 0, color: C.red }}>I need blood</h2><p style={{ marginBottom: 0, color: C.muted }}>Request and see nearby centres</p></Card></a>
        <a href="/donor" style={{ textDecoration: "none", color: "inherit" }}><Card style={{ margin: 0 }}><h2 style={{ margin: 0 }}>I want to donate</h2><p style={{ marginBottom: 0, color: C.muted }}>Get WhatsApp alerts nearby</p></Card></a>
      </div>
    </Shell>
  );
}