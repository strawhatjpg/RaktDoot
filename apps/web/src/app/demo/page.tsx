"use client";
// Demo view of every WhatsApp message the system sent or simulated, newest first,
// with clickable Accept / Ignore buttons that go through the real bot (simulator).
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, Shell, C, api, label } from "../ui.tsx";

interface Msg { id: string; to: string; recipient: string | null; fictional: boolean; purpose: string; status: string; createdAt: string; message: { kind: string; text: string; buttons?: Array<{ id: string; title: string }> } }

export default function DemoInbox() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const load = useCallback(async () => { try { setMsgs((await api<{ messages: Msg[] }>("/api/demo/inbox")).messages); setError(null); } catch (e) { setError((e as Error).message); } }, []);
  useEffect(() => { void load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);
  const tap = async (m: Msg, buttonId: string) => {
    try {
      const r = await api<{ replies: Array<{ text: string }> }>("/api/simulator", { method: "POST", body: { from: m.to, buttonId } });
      setReplies((x) => ({ ...x, [m.id]: r.replies.map((x) => x.text).join("\n") }));
      await load();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Shell>
      <h1>WhatsApp messages</h1>
      <p style={{ color: C.muted, fontSize: 14 }}>Everything RaktDoot sent on WhatsApp. <Badge tone="ok">sent</Badge> went to a real phone; <Badge>simulated</Badge> went to a fictional donor (never really messaged). Buttons here reply through the same bot as WhatsApp.</p>
      <ErrorText error={error} />
      {msgs.length === 0 && <Card><p style={{ color: C.muted }}>No messages yet.</p></Card>}
      {msgs.map((m) => (
        <Card key={m.id} style={{ background: "#e7fbe3", borderColor: "#cdeec6" }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>To {m.recipient ?? "user"} · {m.to} · {label(m.purpose)} · {new Date(m.createdAt).toLocaleTimeString("en-IN")} <Badge tone={m.status === "SENT" ? "ok" : m.status === "FAILED" ? "red" : "muted"}>{m.status.toLowerCase()}</Badge></div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 15 }}>{m.message.text}</div>
          {m.message.buttons && <div>{m.message.buttons.map((b) => <Button key={b.id} kind="secondary" onClick={() => tap(m, b.id)}>{b.title}</Button>)}</div>}
          {replies[m.id] && <div style={{ marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap", color: C.ok }}>Bot replied: {replies[m.id]}</div>}
        </Card>
      ))}
    </Shell>
  );
}