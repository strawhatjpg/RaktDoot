"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BloodRequestDTO } from "@raktdoot/shared";
import { IconArrow, IconPlus } from "../../../components/icons.tsx";
import { useRequireSession } from "../../../components/Session.tsx";
import { Chip, Empty, ErrorCard, PageHeader, Skeleton } from "../../../components/Ui.tsx";
import { api, ApiFailure } from "../../../lib/api.ts";
import { COMPONENT_LABEL, STATUS_LABEL, VERIFICATION_LABEL, formatWhen, shortId, timeAgo } from "../../../lib/format.ts";

export default function MyRequestsPage() {
  const { me } = useRequireSession();
  const [requests, setRequests] = useState<BloodRequestDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const load = () => api.myRequests().then((r) => { setRequests(r); setError(null); }).catch((e) => setError(e instanceof ApiFailure ? e.message : "Could not load cases"));
  useEffect(() => { if (me) void load(); }, [me]);

  if (!me) return null;
  const list = (requests ?? []).filter((r) => filter === "all" || r.status !== "CLOSED");

  return (
    <div className="stack fade-up" style={{ gap: 16 }}>
      <PageHeader title="My cases" subtitle="Every request you raised, with live status."
        action={<Link href="/request/new" className="btn btn-primary btn-sm"><IconPlus width={16} /> New</Link>} />
      <div className="row" style={{ gap: 8 }}>
        {(["active", "all"] as const).map((f) => (
          <button key={f} className={`chip${filter === f ? " chip-red" : ""}`} style={{ cursor: "pointer", height: 34, padding: "0 14px" }} onClick={() => setFilter(f)}>
            {f === "active" ? "Active" : "All"}
          </button>
        ))}
      </div>
      {error ? <ErrorCard message={error} onRetry={() => void load()} /> : requests === null ? (
        <div className="stack"><Skeleton h={96} /><Skeleton h={96} /></div>
      ) : list.length === 0 ? (
        <Empty icon="🩸" title="No cases yet" text="When you raise a blood request, you can follow every step here."
          action={<Link href="/request/new" className="btn btn-primary btn-sm">Request blood</Link>} />
      ) : list.map((r) => (
        <Link key={r.id} href={`/track/${r.id}`} className="glass card hover-lift stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(225,29,72,.18)", border: "1px solid rgba(255,77,109,.3)", fontWeight: 850, fontSize: 18 }}>{r.bloodGroup}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 750 }}>{r.units} × {COMPONENT_LABEL[r.component]}</div>
              <div className="tiny muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.hospitalName}</div>
            </div>
            <IconArrow width={18} className="faint" />
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            <Chip tone="red" live={r.status !== "CLOSED"}>{STATUS_LABEL[r.status]}</Chip>
            <Chip tone={VERIFICATION_LABEL[r.verification].tone}>{VERIFICATION_LABEL[r.verification].text}</Chip>
          </div>
          <div className="row between tiny faint"><span>{shortId(r.id)} · {timeAgo(r.createdAt)}</span><span>needed by {formatWhen(r.neededBy)}</span></div>
        </Link>
      ))}
    </div>
  );
}
