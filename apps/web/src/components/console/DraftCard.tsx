"use client";
// One Copilot draft with approve / edit / reject. Approval is coordinator-only and re-checked by the server.
import { useState } from "react";
import { api, ApiFailure } from "../../lib/api.ts";
import { COMPONENT_LABEL, shortId, timeAgo } from "../../lib/format.ts";
import type { CopilotDraft } from "../../lib/types.ts";
import { useSession } from "../Session.tsx";
import { useToast } from "../Toast.tsx";
import { Chip } from "../Ui.tsx";

const STATUS_TONE = { PENDING_APPROVAL: "amber", APPROVED: "green", REJECTED: "red" } as const;

export function DraftCard({ draft, onChange }: { draft: CopilotDraft; onChange: (d: CopilotDraft) => void }) {
  const toast = useToast();
  const { me } = useSession();
  const canApprove = me?.role === "COORDINATOR" || me?.role === "ADMIN";
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(draft.message);
  const [busy, setBusy] = useState(false);
  const pending = draft.status === "PENDING_APPROVAL";

  async function act(body: { action: "approve" | "reject" } | { action: "edit"; message: string }) {
    setBusy(true);
    try {
      const d = await api.decideDraft(draft.id, body);
      onChange(d);
      setEditing(false);
      toast(body.action === "approve" ? "Approved. Handed to outreach." : body.action === "reject" ? "Draft rejected" : "Draft updated");
    } catch (e) { toast(e instanceof ApiFailure ? e.message : "Action failed", { error: true }); }
    finally { setBusy(false); }
  }

  return (
    <article className="glass card stack" style={{ gap: 12, borderColor: pending ? "rgba(251,191,36,.25)" : undefined }}>
      <div className="row between wrap" style={{ gap: 8 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          <Chip tone={STATUS_TONE[draft.status]}>{draft.status.replace("_", " ").toLowerCase()}</Chip>
          <Chip tone="violet">{draft.kind === "DONOR_OUTREACH" ? "donor outreach" : "donation campaign"}</Chip>
          <Chip tone="red">{draft.bloodGroup} · {COMPONENT_LABEL[draft.component as keyof typeof COMPONENT_LABEL] ?? draft.component}</Chip>
        </div>
        <span className="tiny faint">{draft.requestId ? shortId(draft.requestId) : draft.district} · {timeAgo(draft.createdAt)}</span>
      </div>
      <div className="small"><span className="muted">Audience: </span>{draft.audience}</div>
      {editing ? (
        <textarea className="textarea" value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} aria-label="Draft message" />
      ) : (
        <div style={{ padding: 14, borderRadius: 14, background: "rgba(37,211,102,.06)", border: "1px solid rgba(37,211,102,.18)", whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.5 }}>{draft.message}</div>
      )}
      <div className="tiny muted"><strong>Why:</strong> {draft.rationale}</div>
      {pending && (
        canApprove ? (
          <div className="row wrap" style={{ gap: 8 }}>
            {editing ? (
              <>
                <button className="btn btn-primary btn-sm" disabled={busy || !message.trim()} onClick={() => void act({ action: "edit", message })}>Save edit</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setEditing(false); setMessage(draft.message); }}>Cancel</button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act({ action: "approve" })}>Approve & send</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act({ action: "reject" })}>Reject</button>
              </>
            )}
          </div>
        ) : <span className="tiny faint">Only coordinators can approve outreach.</span>
      )}
    </article>
  );
}
