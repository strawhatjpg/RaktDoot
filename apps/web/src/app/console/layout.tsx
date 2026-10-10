"use client";
// Staff console shell (verified hospital / centre staff, coordinators, admins).
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "../../components/Drop.tsx";
import { IconChart, IconChat, IconHome, IconInbox, IconLogout } from "../../components/icons.tsx";
import { useRequireSession } from "../../components/Session.tsx";
import { Chip, Empty } from "../../components/Ui.tsx";
import { isStaff } from "../../lib/api.ts";

const LINKS = [
  { href: "/console", label: "Overview", Icon: IconHome },
  { href: "/console/forecast", label: "Forecast", Icon: IconChart },
  { href: "/console/copilot", label: "Copilot", Icon: IconChat },
  { href: "/console/drafts", label: "Approvals", Icon: IconInbox },
] as const;

const ROLE: Record<string, string> = { COORDINATOR: "Coordinator", ADMIN: "Admin", HOSPITAL_STAFF: "Hospital staff", BLOOD_CENTRE_STAFF: "Blood centre staff" };

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me, loading, signOut } = useRequireSession();

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner" style={{ padding: "0 20px" }}>
          <div className="row" style={{ gap: 12 }}><Link href="/console"><Brand /></Link><Chip tone="violet">Console</Chip></div>
          <div className="row" style={{ gap: 10 }}>
            {me && <Chip tone={me.verified ? "green" : "amber"}>{ROLE[me.role] ?? me.role}{me.district ? ` · ${me.district}` : ""}</Chip>}
            <Link href="/home" className="btn btn-ghost btn-sm">App</Link>
            {me && <button className="icon-btn" onClick={() => void signOut()} aria-label="Sign out"><IconLogout width={18} /></button>}
          </div>
        </div>
      </div>
      {loading || !me ? null : !isStaff(me) ? (
        <main className="app-shell" style={{ paddingTop: 40 }}>
          <Empty icon="🔒" title="Staff only" text="The console is for verified hospital staff, blood-centre staff and coordinators. Sign in with a staff account."
            action={<Link href="/login?next=/console" className="btn btn-primary btn-sm">Switch account</Link>} />
        </main>
      ) : (
        <div className="console">
          <nav className="sidebar" aria-label="Console">
            {LINKS.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="side-link" aria-current={(href === "/console" ? pathname === href : pathname.startsWith(href)) ? "page" : undefined}>
                <Icon />{label}
              </Link>
            ))}
            <div style={{ flex: 1 }} />
            <div className="glass card tiny muted" style={{ padding: 12 }}>
              Forecasts use <strong>synthetic</strong> data. Copilot only drafts, and a coordinator approves every message.
            </div>
          </nav>
          <main className="console-main">{children}</main>
        </div>
      )}
    </>
  );
}
