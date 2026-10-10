"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, Shell, C, api, label } from "../ui.tsx";
import { useMe } from "../useMe.ts";

interface Wallet { balance: number; entries: Array<{ amount: number; reason: string; note: string | null; createdAt: string }>; referral: { code: string; link: string; whatsappText: string; joined: number; becameDonors: number; donated: number }; coupons: Array<{ redemptionId: string; title: string; sponsor: string; code: string; coins: number; redeemedAt: string }> }
interface Item { id: string; title: string; description: string; costCoins: number; sponsor: string; isSimulated: boolean; remaining: number; perUserLimit: number; redeemedByYou: number }

export default function Rewards() {
  const { me } = useMe();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justRedeemed, setJustRedeemed] = useState<{ title: string; code: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setWallet(await api<Wallet>("/api/rewards")); setItems((await api<{ items: Item[] }>("/api/rewards/store")).items); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (me?.signedIn && me.methods.rewards) void load(); else if (me && !me.signedIn) window.location.href = "/login?returnTo=/rewards"; }, [me, load]);

  const redeem = async (item: Item) => {
    setBusy(item.id); setError(null);
    try {
      const r = await api<{ code: string; title: string }>("/api/rewards/redeem", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: { itemId: item.id } });
      setJustRedeemed({ title: r.title, code: r.code });
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const copy = async () => { if (!wallet) return; await navigator.clipboard.writeText(wallet.referral.link).catch(() => undefined); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (me && !me.methods.rewards) return <Shell><Card>Rewards are not enabled on this server (set FEATURE_TOKEN_REWARDS=true).</Card></Shell>;
  return (
    <Shell>
      <h1>Rewards</h1>
      <ErrorText error={error} />
      {wallet && (
        <Card style={{ borderColor: C.red }}>
          <div style={{ fontSize: 14, color: C.muted }}>Your RaktDoot coins</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: C.red }}>🪙 {wallet.balance}</div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 0 }}>Earn 100 coins for each donation confirmed by a blood centre, 25 when someone you invite registers as a donor, and 50 more when they first donate. Coins have no cash value, can&apos;t be transferred, and never affect anyone&apos;s access to blood.</p>
        </Card>
      )}
      {justRedeemed && (
        <Card style={{ borderColor: C.ok, background: "#effaf0" }}>
          <strong>{justRedeemed.title}</strong> — your coupon code: <code style={{ fontSize: 18 }}>{justRedeemed.code}</code>
        </Card>
      )}
      {wallet && (
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Invite friends</h2>
          <p style={{ fontSize: 14, margin: "4px 0" }}><code>{wallet.referral.link}</code></p>
          <Button kind="secondary" onClick={copy}>{copied ? "Copied!" : "Copy link"}</Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(wallet.referral.whatsappText)}`} target="_blank" rel="noopener"><Button kind="secondary">Share on WhatsApp</Button></a>
          <p style={{ fontSize: 13, color: C.muted }}>{wallet.referral.joined} joined · {wallet.referral.becameDonors} became donors · {wallet.referral.donated} donated</p>
        </Card>
      )}
      <h2 style={{ fontSize: 18 }}>Sponsor store</h2>
      {items.length === 0 && <Card><p style={{ color: C.muted }}>No rewards available right now.</p></Card>}
      {items.map((i) => {
        const limit = i.redeemedByYou >= i.perUserLimit;
        const short = (wallet?.balance ?? 0) < i.costCoins;
        return (
          <Card key={i.id}>
            <div style={{ fontSize: 12, color: C.muted }}>{i.sponsor} {i.isSimulated && <Badge>demo sponsor</Badge>}</div>
            <strong>{i.title}</strong>
            <p style={{ fontSize: 14, margin: "4px 0" }}>{i.description}</p>
            <Badge tone="red">🪙 {i.costCoins}</Badge> <span style={{ fontSize: 12, color: C.muted }}>{i.remaining} left</span>
            <div><Button onClick={() => redeem(i)} disabled={busy !== null || limit || short || i.remaining === 0}>{limit ? "Redeemed" : i.remaining === 0 ? "Out of stock" : short ? `Need ${i.costCoins - (wallet?.balance ?? 0)} more` : busy === i.id ? "Redeeming…" : "Redeem"}</Button></div>
          </Card>
        );
      })}
      {wallet && wallet.coupons.length > 0 && (
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>My coupons</h2>
          {wallet.coupons.map((c) => <div key={c.redemptionId} style={{ fontSize: 14, padding: "4px 0" }}>{c.sponsor} — {c.title}: <code>{c.code}</code></div>)}
        </Card>
      )}
      {wallet && wallet.entries.length > 0 && (
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>History</h2>
          {wallet.entries.map((e, n) => <div key={n} style={{ fontSize: 13, padding: "2px 0" }}><strong style={{ color: e.amount > 0 ? C.ok : C.red }}>{e.amount > 0 ? "+" : ""}{e.amount}</strong> · {e.note ?? label(e.reason)} <span style={{ color: C.muted }}>· {new Date(e.createdAt).toLocaleDateString("en-IN")}</span></div>)}
        </Card>
      )}
    </Shell>
  );
}