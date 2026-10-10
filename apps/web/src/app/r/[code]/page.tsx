"use client";
// Referral landing page: /r/<code>. Two ways to join — WhatsApp (prefilled "JOIN <code>")
// or the app. The referrer earns only when this person registers as a donor.
import { use, useEffect } from "react";
import { Button, Card, Shell, C } from "../../ui.tsx";
import { REF_KEY, useMe } from "../../useMe.ts";

export default function Referral({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const { me } = useMe();
  useEffect(() => { if (clean.length === 8) window.localStorage.setItem(REF_KEY, clean); }, [clean]);
  const wa = me?.methods.botNumber ? `https://wa.me/${me.methods.botNumber}?text=${encodeURIComponent(`JOIN ${clean}`)}` : null;
  return (
    <Shell>
      <h1>You&apos;ve been invited to RaktDoot</h1>
      <p style={{ color: C.muted }}>Join a network of volunteer donors. When a verified patient nearby needs your blood group, you get a WhatsApp message and choose Accept or Ignore. You donate only at a licensed blood centre.</p>
      <Card>
        {wa && <a href={wa}><Button>Join on WhatsApp</Button></a>}
        <a href="/login?returnTo=/donor"><Button kind={wa ? "secondary" : "primary"}>Sign up in the app</Button></a>
        <p style={{ fontSize: 13, color: C.muted }}>Invite code <strong>{clean}</strong>. Your friend earns coins only if you register as a donor — never just for opening this link.</p>
      </Card>
    </Shell>
  );
}